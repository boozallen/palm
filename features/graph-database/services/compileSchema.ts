import { z } from 'zod';
import type { ToolDefinition } from '@/features/ai-provider/sources/types';
import { ANY_TYPE, type GraphSchema, type PropertyDef } from '@/features/graph-database/config/schemas/types';

/**
 * Compile a `GraphSchema` into the artifacts the extraction path needs:
 *   - `systemPrompt`: extraction instructions generated from the schema
 *   - `tool`: a forced structured-output tool (`extract_graph`) with a JSON Schema
 *   - `zodSchema`: the Zod validator for the tool's `toolInput`
 *
 * CACHE PREFIX: `systemPrompt` and `tool` are a PURE FUNCTION of the schema —
 * they contain NO chunk/document text (that is passed separately as a user
 * message). This keeps Bedrock's `cachePoint` (placed after the system prompt
 * and tool defs) valid across every chunk in a build.
 */

/** Node-node infra fields that custom node properties must never overwrite. */
export const RESERVED_NODE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'normalizedName',
  'type',
  'category',
  'description',
  'aliases',
  'documentId',
  'userId',
  'mentionCount',
  'firstSeenAt',
  'needsEmbedding',
  'extracted',
]);

/** RELATED-edge infra fields that custom edge properties must never overwrite. */
export const RESERVED_EDGE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'phase',
  'relationType',
  'description',
  'context',
  'documentId',
  'chunkId',
  'confidence',
  'decidedBy',
]);

const PROPERTY_VALUE = z.union([z.string(), z.number(), z.boolean()]);

/** Zod shape of the validated `extract_graph` tool input. */
const extractedEntitySchema = z.object({
  text: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional().default(''),
  aliases: z.array(z.string()).optional().default([]),
  context: z.string().optional().default(''),
  confidence: z.number().optional().default(0.5),
  // Lenient on values; the extractor sanitizes to string|number|boolean.
  properties: z.record(z.unknown()).optional(),
});

const extractedConceptSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().default(''),
  context: z.string().optional().default(''),
  relevance: z.number().optional().default(0.5),
  sentiment: z.string().optional().default('NEUTRAL'),
  properties: z.record(z.unknown()).optional(),
});

const extractedRelationshipSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  relationType: z.string().min(1),
  description: z.string().optional().default(''),
  context: z.string().optional().default(''),
  confidence: z.number().optional().default(0.5),
  properties: z.record(z.unknown()).optional(),
});

const extractGraphSchema = z.object({
  entities: z.array(extractedEntitySchema).optional().default([]),
  concepts: z.array(extractedConceptSchema).optional().default([]),
  relationships: z.array(extractedRelationshipSchema).optional().default([]),
  summary: z.string().optional().default(''),
});

export type CompiledExtraction = z.infer<typeof extractGraphSchema>;
export type CompiledPropertyValue = z.infer<typeof PROPERTY_VALUE>;

export interface CompiledSchema {
  systemPrompt: string;
  tool: ToolDefinition;
  zodSchema: typeof extractGraphSchema;
}

/** Map a PropertyDef value type to a JSON Schema type. Dates are ISO strings. */
function jsonTypeOf(type: PropertyDef['type']): 'string' | 'number' | 'boolean' {
  switch (type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
    case 'date':
    default:
      return 'string';
  }
}

/** Render an `allowedEndpoints` pair, mapping the wildcard to "any". */
function renderEndpoint(type: string): string {
  return type === ANY_TYPE ? 'any node type' : type;
}

/**
 * Collapse every node type's properties into one flat JSON Schema `properties`
 * map (keyed by property name). Different node types have different properties;
 * this permissive container lists them all so the model knows the field names.
 */
function collectProperties(defs: { properties?: PropertyDef[]; type?: string; relationType?: string }[]): {
  jsonProperties: Record<string, { type: string; description: string }>;
  hasAny: boolean;
} {
  const jsonProperties: Record<string, { type: string; description: string }> = {};

  for (const def of defs) {
    const owner = def.type ?? def.relationType ?? '';
    for (const prop of def.properties ?? []) {
      const ownerNote = owner ? ` (${owner})` : '';
      if (jsonProperties[prop.name]) {
        // Same property name on multiple types — append the owner to the description.
        jsonProperties[prop.name].description += `${ownerNote}`;
      } else {
        jsonProperties[prop.name] = {
          type: jsonTypeOf(prop.type),
          description: `${prop.description}${ownerNote}`,
        };
      }
    }
  }

  return { jsonProperties, hasAny: Object.keys(jsonProperties).length > 0 };
}

/** Build the schema-driven extraction system prompt (no chunk text). */
function buildSystemPrompt(schema: GraphSchema): string {
  const entityTypeLines = schema.nodeTypes
    .map((n) => {
      const examples = n.examples?.length ? ` (e.g., ${n.examples.join(', ')})` : '';
      return `- **${n.type}**: ${n.description}${examples}`;
    })
    .join('\n');

  const nodePropertyBlocks = schema.nodeTypes
    .filter((n) => n.properties && n.properties.length > 0)
    .map((n) => {
      const props = n.properties!
        .map((p) => `    - \`${p.name}\` (${p.type}): ${p.description}`)
        .join('\n');
      return `  For **${n.type}** entities, capture these properties when present in the text:\n${props}`;
    })
    .join('\n');

  const relationshipLines = schema.edgeTypes
    .map((e) => {
      const endpoints = e.allowedEndpoints
        .map(([from, to]) => `${renderEndpoint(from)} → ${renderEndpoint(to)}`)
        .join('; ');
      return `- **${e.relationType}** (${endpoints}): ${e.description}`;
    })
    .join('\n');

  const edgePropertyBlocks = schema.edgeTypes
    .filter((e) => e.properties && e.properties.length > 0)
    .map((e) => {
      const props = e.properties!
        .map((p) => `    - \`${p.name}\` (${p.type}): ${p.description}`)
        .join('\n');
      return `  For **${e.relationType}** relationships, capture these properties when present:\n${props}`;
    })
    .join('\n');

  const sections: string[] = [];

  sections.push(`Analyze the provided text and extract a knowledge graph using the "${schema.name}" schema:
1. **Entities**: Named entities with full context
2. **Concepts**: Key concepts and ideas discussed
3. **Relationships**: Explicit relationships between entities/concepts
4. **Summary**: A concise 1-2 sentence summary`);

  sections.push(`IMPORTANT: If the text is primarily tabular data, benchmark numbers, comparison tables, or lacks
meaningful prose context, return empty arrays for entities, concepts, and relationships with an
empty summary. Only extract from text that has descriptive narrative content.`);

  sections.push(`Entity types:
${entityTypeLines}`);

  sections.push(`For each entity, provide:
- **text**: The MOST COMPLETE form of the entity's name found in this text
  - For people: always use full name including surname when available (e.g., "Jon Noronha" not "Jon")
  - For organizations: use full official name (e.g., "Defense Health Agency" not "DHA")
  - Place shorter forms (first names, acronyms, abbreviations) in the aliases field instead
- **type**: one of the entity types listed above
- **description**: 1-2 sentences explaining what/who this entity is. When summarizing conditions, classifications, or cause-effect relationships, preserve the logical direction exactly.
- **aliases**: Array of alternative names for THE EXACT SAME entity
  - INCLUDE: acronyms, full formal names, official abbreviations, well-known nicknames
  - EXCLUDE: subsidiaries, divisions, products, parent companies — these are SEPARATE entities, not aliases
  - EXCLUDE: generic references like "the company", "the system", "the document", pronouns
- **context**: The surrounding sentence or phrase containing this entity
- **confidence**: 0.0 to 1.0
- **properties**: An object of schema-defined properties for this entity's type (see below). Only include keys defined for the type, and only when the value is stated in the text. Omit unknown properties.`);

  if (nodePropertyBlocks) {
    sections.push(`Entity properties by type:\n${nodePropertyBlocks}`);
  }

  sections.push(`Concept categories: ${schema.conceptCategories.join(', ')}.

For each concept, provide:
- **name**: The concept name
- **category**: one of the concept categories above
- **description**: 1-2 sentences explaining this concept. Preserve logical direction exactly.
- **context**: The surrounding sentence or phrase where this concept is discussed
- **relevance**: 0.0 to 1.0
- **sentiment**: POSITIVE, NEUTRAL, or NEGATIVE`);

  sections.push(`Relationship types:
${relationshipLines}
- If none of the above fit, use the closest type and explain in the description.

For each relationship, provide:
- **source**: Name of the source entity/concept (as it appears in text)
- **target**: Name of the target entity/concept (as it appears in text)
- **relationType**: one of the relationship types above
- **description**: Natural language description of the relationship
- **context**: The sentence or phrase containing this relationship
- **confidence**: 0.0 to 1.0
- **properties**: An object of schema-defined properties for this relationship's type (see below), when stated.`);

  if (edgePropertyBlocks) {
    sections.push(`Relationship properties by type:\n${edgePropertyBlocks}`);
  }

  if (schema.guidance) {
    sections.push(`Additional guidance:\n${schema.guidance}`);
  }

  sections.push('Call the \`extract_graph\` tool with the extracted entities, concepts, relationships, and summary.');

  return sections.join('\n\n');
}

/** Build the JSON Schema for the `extract_graph` tool input. */
function buildToolInputSchema(schema: GraphSchema): Record<string, unknown> {
  const entityTypeEnum = schema.nodeTypes.map((n) => n.type);
  const relationTypeEnum = schema.edgeTypes.map((e) => e.relationType);

  const nodeProps = collectProperties(schema.nodeTypes);
  const edgeProps = collectProperties(schema.edgeTypes);

  const entityPropertiesSchema = nodeProps.hasAny
    ? {
        type: 'object',
        description: 'Schema-defined properties for this entity, keyed by property name. Only include keys defined for the entity type.',
        properties: nodeProps.jsonProperties,
        additionalProperties: true,
      }
    : undefined;

  const relationshipPropertiesSchema = edgeProps.hasAny
    ? {
        type: 'object',
        description: 'Schema-defined properties for this relationship, keyed by property name.',
        properties: edgeProps.jsonProperties,
        additionalProperties: true,
      }
    : undefined;

  const entityItem: Record<string, unknown> = {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The most complete form of the entity name.' },
      type: { type: 'string', enum: entityTypeEnum, description: 'The entity type from the schema.' },
      description: { type: 'string' },
      aliases: { type: 'array', items: { type: 'string' } },
      context: { type: 'string' },
      confidence: { type: 'number' },
      ...(entityPropertiesSchema ? { properties: entityPropertiesSchema } : {}),
    },
    required: ['text', 'type'],
  };

  const conceptItem: Record<string, unknown> = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      category: { type: 'string', enum: schema.conceptCategories },
      description: { type: 'string' },
      context: { type: 'string' },
      relevance: { type: 'number' },
      sentiment: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
    },
    required: ['name', 'category'],
  };

  const relationshipItem: Record<string, unknown> = {
    type: 'object',
    properties: {
      source: { type: 'string' },
      target: { type: 'string' },
      relationType: { type: 'string', enum: relationTypeEnum },
      description: { type: 'string' },
      context: { type: 'string' },
      confidence: { type: 'number' },
      ...(relationshipPropertiesSchema ? { properties: relationshipPropertiesSchema } : {}),
    },
    required: ['source', 'target', 'relationType'],
  };

  return {
    type: 'object',
    properties: {
      entities: { type: 'array', items: entityItem },
      concepts: { type: 'array', items: conceptItem },
      relationships: { type: 'array', items: relationshipItem },
      summary: { type: 'string', description: 'A concise 1-2 sentence summary of the chunk.' },
    },
    required: ['entities', 'concepts', 'relationships', 'summary'],
  };
}

export function compileSchema(schema: GraphSchema): CompiledSchema {
  const systemPrompt = buildSystemPrompt(schema);

  const tool: ToolDefinition = {
    name: 'extract_graph',
    description: `Extract a knowledge graph (entities, concepts, relationships, summary) from the text using the "${schema.name}" schema.`,
    inputSchema: buildToolInputSchema(schema),
  };

  return { systemPrompt, tool, zodSchema: extractGraphSchema };
}
