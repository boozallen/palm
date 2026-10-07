// Graph extraction schema model (v1)
//
// A `GraphSchema` is the selectable, domain-specific vocabulary that drives
// knowledge-graph extraction. It is compiled (`compileSchema`) into an
// extraction system prompt + a structured-output tool definition, so the LLM
// emits typed nodes/edges plus custom per-type properties.
//
// Schemas are plain seeded TypeScript data (no DB table in v1 → no migration).
// Neo4j stores `type`/`relationType` as properties (labels stay :Entity/:Concept
// and edges collapse to :RELATED), so custom types need zero graph migration.

/**
 * Wildcard endpoint: an `allowedEndpoints` pair containing `ANY_TYPE` matches
 * any node type. Used by broad/general relationships that are not constrained
 * to specific entity types.
 */
export const ANY_TYPE = '*';

/**
 * A custom property captured on a node or edge type.
 * `type` is the declared value type; `date` values are stored as ISO strings.
 */
export interface PropertyDef {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  description: string;
}

/**
 * A node (entity) type in a schema. Reproduces today's entity-type vocabulary
 * when used in the `general` schema; domain schemas add custom types + properties.
 */
export interface NodeTypeDef {
  type: string;
  description: string;
  examples?: string[];
  properties?: PropertyDef[];
}

/**
 * An edge (relationship) type in a schema.
 *
 * `allowedEndpoints` pairs are `[fromType, toType]` at ENTITY-TYPE granularity
 * (e.g. `['Requirement', 'System']`) — finer than the node-category pairs in
 * `storage-model.config.ts`. They guide the LLM and document the ontology; they
 * are not enforced as a hard drop in v1 (strict mode is deferred).
 */
export interface EdgeTypeDef {
  relationType: string;
  description: string;
  allowedEndpoints: [string, string][];
  properties?: PropertyDef[];
}

/**
 * A complete, selectable extraction schema.
 */
export interface GraphSchema {
  key: string;
  name: string;
  description?: string;
  nodeTypes: NodeTypeDef[];
  conceptCategories: string[];
  edgeTypes: EdgeTypeDef[];
  /** Free-form extra guidance appended to the compiled system prompt. */
  guidance?: string;
}
