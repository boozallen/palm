import { logger } from '@/server/logger';
import {
  ChunkAnalysis,
  EntityType,
  ConceptCategory,
  ExtractedEntity,
  ExtractedConcept,
  ExtractedRelationship,
} from '@/features/graph-database/types';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { GRAPH_BUILD_LLM_REQUEST_TIMEOUT_MS } from '@/features/graph-database/config/graph-build.config';
import { compileSchema } from '@/features/graph-database/services/compileSchema';
import type { GraphSchema } from '@/features/graph-database/config/schemas/types';
import type { AiRepository, ToolAwareMessage } from '@/features/ai-provider/sources/types';

/**
 * Entity extraction service using LLM
 * This extracts entities and concepts from document chunks
 */

const ENTITY_EXTRACTION_PROMPT = `Analyze the following text and extract:
1. **Entities**: Named entities with full context
2. **Concepts**: Key concepts and ideas discussed
3. **Relationships**: Explicit relationships between entities/concepts
4. **Summary**: A concise 1-2 sentence summary

IMPORTANT: If the text is primarily tabular data, benchmark numbers, comparison tables, or lacks
meaningful prose context, return empty arrays for entities, concepts, and relationships with an
empty summary. Only extract from text that has descriptive narrative content.

For each entity, provide:
- **text**: The MOST COMPLETE form of the entity's name found in this text
  - For people: always use full name including surname when available (e.g., "Jon Noronha" not "Jon")
  - For organizations: use full official name (e.g., "Defense Health Agency" not "DHA")
  - Place shorter forms (first names, acronyms, abbreviations) in the aliases field instead
- **type**: PERSON, ORGANIZATION, LOCATION, TECHNOLOGY, PRODUCT, DATE, or DOCUMENT (laws, regulations, standards, policies)
- **description**: 1-2 sentences explaining what/who this entity is. When summarizing conditions, classifications, or cause-effect relationships, preserve the logical direction exactly.
- **aliases**: Array of alternative names for THE EXACT SAME entity
  - INCLUDE: acronyms ("AWS"), full formal names ("Amazon Web Services"), official abbreviations, well-known nicknames
  - EXCLUDE: subsidiaries, divisions, products, parent companies, acquisitions -- these are SEPARATE entities, not aliases
  - EXCLUDE: Generic references like "the company", "the system", "the paper", "the study", "the document", "the research", "the authors", "it", "they", pronouns
  - "Google Brain" is NOT an alias for "Google" -- it is a separate entity (a research division)
  - "Azure" is NOT an alias for "Microsoft" -- it is a separate entity (a cloud platform)
  - "Alphabet" is NOT an alias for "Google" -- it is a separate entity (the parent company)
  - Ask yourself: "Does this name refer to the EXACT same thing, or to something related but distinct?" Only include if the answer is "the exact same thing."
  - Example: "DHA" → ["Defense Health Agency"] (NOT "the agency")
  - Example: "LightRAG Guo et al. [2024]" → ["LightRAG"] (NOT "the paper", "the study")
- **context**: The surrounding sentence or phrase containing this entity
- **confidence**: 0.0 to 1.0

For each concept, provide:
- **name**: The concept name
- **category**: TECHNICAL, BUSINESS, DOMAIN_SPECIFIC, or GENERAL
- **description**: 1-2 sentences explaining this concept. When summarizing conditions, classifications, or cause-effect relationships, preserve the logical direction exactly.
- **context**: The surrounding sentence or phrase where this concept is discussed
- **relevance**: 0.0 to 1.0
- **sentiment**: POSITIVE, NEUTRAL, or NEGATIVE

For each relationship, provide:
- **source**: Name of the source entity/concept (as it appears in text)
- **target**: Name of the target entity/concept (as it appears in text)
- **relationType**: Type of relationship (see list below)
- **description**: Natural language description of the relationship
- **context**: The sentence or phrase containing this relationship
- **confidence**: 0.0 to 1.0

Relationship Types:
- WORKS_FOR, MANAGES, REPORTS_TO, MEMBER_OF (organizational)
- PART_OF, SUBSIDIARY_OF, DIVISION_OF, OWNS (structural)
- LOCATED_IN, BASED_IN, OPERATES_IN (locational)
- RELATES_TO, REQUIRES, IMPLEMENTS, USES (conceptual)
- SUCCEEDED_BY, PRECEDED_BY (temporal)
- OTHER (if none above fit, specify in description)

Return JSON in this exact format:
{
  "entities": [
    {
      "text": "Defense Health Agency",
      "type": "ORGANIZATION",
      "description": "Defense Health Agency, a U.S. military healthcare organization",
      "aliases": ["DHA"],
      "context": "The DHA oversees military health operations",
      "confidence": 0.95
    }
  ],
  "concepts": [
    {
      "name": "Machine Learning",
      "category": "TECHNICAL",
      "description": "A subset of AI focused on training algorithms to learn from data",
      "context": "The document discusses machine learning applications in healthcare",
      "relevance": 0.9,
      "sentiment": "POSITIVE"
    }
  ],
  "relationships": [
    {
      "source": "John Smith",
      "target": "Microsoft",
      "relationType": "WORKS_FOR",
      "description": "John Smith works for Microsoft as a software engineer",
      "context": "John Smith, a software engineer at Microsoft, developed...",
      "confidence": 0.95
    },
    {
      "source": "Machine Learning",
      "target": "Statistical Analysis",
      "relationType": "REQUIRES",
      "description": "Machine Learning requires statistical analysis techniques",
      "context": "ML models require statistical analysis for validation...",
      "confidence": 0.90
    },
    {
      "source": "Microsoft",
      "target": "Agile Development",
      "relationType": "IMPLEMENTS",
      "description": "Microsoft implements Agile development methodology",
      "context": "Microsoft implements Agile practices in its teams...",
      "confidence": 0.85
    }
  ],
  "summary": "Brief summary of the chunk"
}

Text to analyze:
---
{TEXT}
---

Return ONLY valid JSON, no additional text.`;

interface EntityExtractionResponse {
  entities: Array<{
    text: string;
    type: EntityType;
    confidence: number;
    description: string;
    aliases: string[];
    context: string;
  }>;
  concepts: Array<{
    name: string;
    category: ConceptCategory;
    relevance: number;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    description: string;
    context: string;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    relationType: string;
    description: string;
    context: string;
    confidence: number;
  }>;
  summary: string;
}

/**
 * Extract entities and concepts from a chunk using LLM.
 *
 * When a `schema` is provided (CUSTOM_GRAPH_SCHEMA on) and the provider supports
 * tool calling, extraction routes through `chatCompletionWithTools` with a forced
 * structured-output tool compiled from the schema (Zod-validated), capturing
 * custom per-type properties. Otherwise the legacy regex-parsed `completion`
 * path runs unchanged.
 */
export async function extractEntitiesFromChunk(
  chunkContent: string,
  chunkId: string,
  userId: string,
  documentId: string,
  schema?: GraphSchema
): Promise<ChunkAnalysis> {
  try {
    // Import AI factory dynamically to avoid circular dependencies
    const { AIFactory } = await import('@/features/ai-provider/factory');

    const factory = new AIFactory({ userId });
    const { source: aiProvider, model } = await factory.buildKnowledgeGraphSource({
      requestTimeoutMs: GRAPH_BUILD_LLM_REQUEST_TIMEOUT_MS,
    });

    // Schema-driven structured-output path. Falls back to the legacy path when
    // the provider does not implement tool calling.
    if (schema && typeof aiProvider.chatCompletionWithTools === 'function') {
      return await extractWithSchema(aiProvider, model.externalId, schema, chunkContent, chunkId, documentId);
    }

    const prompt = ENTITY_EXTRACTION_PROMPT.replace('{TEXT}', chunkContent);

    logger.debug(`[GRAPH-EXTRACT] Extracting entities from chunk ${chunkId}`);

    const response = await retryWithBackoff(() =>
      aiProvider.completion(prompt, {
        model: model.externalId,
        temperature: 0.1, // Low temperature for consistent extraction
        topP: 0.5,
      })
    );

    // Parse the JSON response
    const extractedData = parseEntityExtractionResponse(response.text);

    // Find character positions for entities in the original text
    const entitiesWithPositions = extractedData.entities.map((entity) => ({
      ...entity,
      positions: findEntityPositions(chunkContent, entity.text),
    }));

    return {
      chunkId,
      content: chunkContent,
      entities: entitiesWithPositions,
      concepts: extractedData.concepts,
      relationships: extractedData.relationships,
      summary: extractedData.summary,
      documentId,
    };
  } catch (error) {
    logger.error(`[GRAPH-EXTRACT] Error extracting entities from chunk ${chunkId}:`, error);

    // Return empty analysis on error
    return emptyAnalysis(chunkId, chunkContent, documentId);
  }
}

/** Empty analysis returned on any extraction failure (existing failure contract). */
function emptyAnalysis(chunkId: string, chunkContent: string, documentId: string): ChunkAnalysis {
  return {
    chunkId,
    content: chunkContent,
    entities: [],
    concepts: [],
    relationships: [],
    summary: '',
    documentId,
  };
}

/** Clamp a confidence/relevance score to [0, 1], defaulting to 0.5. */
function clamp01(value: number | undefined): number {
  return Math.min(Math.max(value ?? 0.5, 0), 1);
}

/**
 * Keep only primitive (string | number | boolean) property values. The LLM may
 * emit nested objects or nulls; those are dropped so the property bag matches
 * what Neo4j can store. Returns undefined when nothing usable remains.
 */
function sanitizeProperties(
  raw: Record<string, unknown> | undefined
): Record<string, string | number | boolean> | undefined {
  if (!raw) {
    return undefined;
  }

  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Structured-output extraction using a compiled schema + forced tool call.
 * On a missing tool call or Zod-validation failure, returns an empty analysis
 * (same failure contract as the legacy parse path).
 */
async function extractWithSchema(
  aiProvider: AiRepository,
  modelExternalId: string,
  schema: GraphSchema,
  chunkContent: string,
  chunkId: string,
  documentId: string
): Promise<ChunkAnalysis> {
  const compiled = compileSchema(schema);

  const messages: ToolAwareMessage[] = [
    { role: 'system', content: compiled.systemPrompt },
    { role: 'user', content: chunkContent },
  ];

  logger.debug(`[GRAPH-EXTRACT] Extracting entities from chunk ${chunkId} via schema "${schema.key}"`);

  const response = await retryWithBackoff(() =>
    // Guarded by the caller: chatCompletionWithTools is present on this provider.
    aiProvider.chatCompletionWithTools!(
      messages,
      [compiled.tool],
      {
        model: modelExternalId,
        temperature: 0.1, // Low temperature for consistent extraction
        topP: 0.5,
      },
      true
    )
  );

  if (response.type !== 'tool_call') {
    logger.warn(
      `[GRAPH-EXTRACT] No tool_call returned for chunk ${chunkId} (schema "${schema.key}"); returning empty analysis`
    );
    return emptyAnalysis(chunkId, chunkContent, documentId);
  }

  const parsed = compiled.zodSchema.safeParse(response.toolInput);
  if (!parsed.success) {
    logger.error(
      `[GRAPH-EXTRACT] Structured extraction failed Zod validation for chunk ${chunkId} (schema "${schema.key}")`,
      { issues: parsed.error.issues, raw: response.toolInput }
    );
    return emptyAnalysis(chunkId, chunkContent, documentId);
  }

  const data = parsed.data;

  const entities: ExtractedEntity[] = data.entities.map((entity) => ({
    text: entity.text,
    type: entity.type,
    positions: findEntityPositions(chunkContent, entity.text),
    confidence: clamp01(entity.confidence),
    description: entity.description,
    aliases: filterGenericAliases(entity.aliases),
    context: entity.context,
    properties: sanitizeProperties(entity.properties),
  }));

  const concepts: ExtractedConcept[] = data.concepts.map((concept) => ({
    name: concept.name,
    category: validateConceptCategory(concept.category),
    relevance: clamp01(concept.relevance),
    sentiment: validateSentiment(concept.sentiment),
    description: concept.description,
    context: concept.context,
    properties: sanitizeProperties(concept.properties),
  }));

  const relationships: ExtractedRelationship[] = data.relationships.map((rel) => ({
    source: rel.source,
    target: rel.target,
    relationType: rel.relationType,
    description: rel.description,
    context: rel.context,
    confidence: clamp01(rel.confidence),
    properties: sanitizeProperties(rel.properties),
  }));

  return {
    chunkId,
    content: chunkContent,
    entities,
    concepts,
    relationships,
    summary: data.summary,
    documentId,
  };
}

/**
 * Generic aliases that should be filtered out
 * These cause false positive matches during entity resolution
 */
const GENERIC_ALIAS_PATTERNS = [
  // Articles + nouns
  /^the\s+(paper|study|document|research|system|company|organization|agency|person|author|authors|report|article|work|project|program|initiative|platform|tool|solution|application|app|service|product|entity|item|thing)s?$/i,
  // Pronouns
  /^(it|they|them|he|she|him|her|this|that|these|those)$/i,
  // Very short/generic
  /^(the|a|an)$/i,
];

/**
 * Filter out generic aliases that would cause false matches
 * Keeps only specific, unique identifiers
 */
function filterGenericAliases(aliases: string[]): string[] {
  return aliases.filter(alias => {
    const trimmed = alias.trim();

    // Filter out empty strings
    if (!trimmed) {
      return false;
    }

    // Filter out very short aliases (likely generic)
    if (trimmed.length < 2) {
      return false;
    }

    // Filter out aliases matching generic patterns
    for (const pattern of GENERIC_ALIAS_PATTERNS) {
      if (pattern.test(trimmed)) {
        logger.debug(`[GRAPH-EXTRACT] Filtered generic alias: "${trimmed}"`);
        return false;
      }
    }

    return true;
  });
}

/**
 * Parse and validate the LLM response
 */
function parseEntityExtractionResponse(content: string): EntityExtractionResponse {
  try {
    // Try to extract JSON from the response (in case LLM added extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize the response
    return {
      entities: Array.isArray(parsed.entities)
        ? parsed.entities
            .filter((e: any) => e.text && e.type)
            .map((e: any) => ({
              text: e.text,
              type: validateEntityType(e.type),
              confidence: Math.min(Math.max(e.confidence || 0.5, 0), 1),
              description: typeof e.description === 'string' ? e.description : '',
              aliases: Array.isArray(e.aliases) ? filterGenericAliases(e.aliases) : [],
              context: typeof e.context === 'string' ? e.context : '',
            }))
        : [],
      concepts: Array.isArray(parsed.concepts)
        ? parsed.concepts
            .filter((c: any) => c.name && c.category)
            .map((c: any) => ({
              name: c.name,
              category: validateConceptCategory(c.category),
              relevance: Math.min(Math.max(c.relevance || 0.5, 0), 1),
              sentiment: validateSentiment(c.sentiment),
              description: typeof c.description === 'string' ? c.description : '',
              context: typeof c.context === 'string' ? c.context : '',
            }))
        : [],
      relationships: Array.isArray(parsed.relationships)
        ? parsed.relationships
            .filter((r: any) => r.source && r.target && r.relationType)
            .map((r: any) => ({
              source: r.source,
              target: r.target,
              relationType: r.relationType.toUpperCase().replace(/\s+/g, '_'),
              description: typeof r.description === 'string' ? r.description : '',
              context: typeof r.context === 'string' ? r.context : '',
              confidence: Math.min(Math.max(r.confidence || 0.5, 0), 1),
            }))
        : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch (error) {
    logger.error('[GRAPH-EXTRACT] Error parsing entity extraction response:', error);
    return {
      entities: [],
      concepts: [],
      relationships: [],
      summary: '',
    };
  }
}

/**
 * Find all positions where an entity appears in the text
 */
function findEntityPositions(text: string, entity: string): number[] {
  const positions: number[] = [];
  const lowerText = text.toLowerCase();
  const lowerEntity = entity.toLowerCase();

  let pos = lowerText.indexOf(lowerEntity);
  while (pos !== -1) {
    positions.push(pos);
    pos = lowerText.indexOf(lowerEntity, pos + 1);
  }

  return positions;
}

/**
 * Validate and normalize entity type
 * Returns the type as-is but logs warning if invalid
 */
function validateEntityType(type: string): string {
  const upperType = type.toUpperCase();
  if (Object.values(EntityType).includes(upperType as EntityType)) {
    return upperType;
  }
  // Log invalid type but allow entity creation to continue
  logger.warn(
    `[GRAPH-EXTRACT] LLM returned invalid entity type "${type}". Expected: ${Object.values(EntityType).join(', ')}. ` +
    'Entity will be created with this type for later review.'
  );
  return upperType; // Return as-is for tracking
}

/**
 * Validate and normalize concept category
 */
function validateConceptCategory(category: string): ConceptCategory {
  const upperCategory = category.toUpperCase();
  if (Object.values(ConceptCategory).includes(upperCategory as ConceptCategory)) {
    return upperCategory as ConceptCategory;
  }
  return ConceptCategory.GENERAL; // Default fallback
}

/**
 * Validate sentiment
 */
function validateSentiment(sentiment: string): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' {
  const upperSentiment = sentiment?.toUpperCase();
  if (['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(upperSentiment)) {
    return upperSentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  }
  return 'NEUTRAL'; // Default fallback
}
