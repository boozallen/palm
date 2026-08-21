// GraphRAG Configuration Files
// This canvas contains four logical config modules:
// 1) storage-model.config.ts
// 2) signals.config.ts
// 3) resolution-policy.config.ts
// 4) query-rules.config.ts

// -----------------------------------------------------------------------------
// 1) storage-model.config.ts
// -----------------------------------------------------------------------------

// ARCHITECTURE NOTE: Embeddings stored in PostgreSQL, not Neo4j
// - Existing: Embedding table (for chunks) - DO NOT MODIFY
// - New: GraphEntityEmbedding table (for entity nodes)
// - New: GraphConceptEmbedding table (for concept nodes)
// LINKING: Same UUID used for both Neo4j node.id and PostgreSQL table.id
// Pattern: Generate one UUID, use for both systems (no separate embeddingId needed)
// This matches existing architecture where Chunk.id = Embedding.id

// High-level node categories stored in the graph
// NOTE: Topic nodes removed - redundant with Concepts. May be re-added later via community detection.
export type NodeCategory = 'ENTITY' | 'CONCEPT' | 'DOCUMENT' | 'CHUNK';

// ---------------------------------------------------------------------------
// Node instance models (TypeScript-level, not persisted as-is)
// ---------------------------------------------------------------------------

// Core properties shared by all nodes
export interface BaseNodeProps {
  id: string;                 // Same UUID used in both Neo4j and PostgreSQL
  documentId?: string;        // required for CHUNK/ENTITY/CONCEPT, optional for DOCUMENT
}

export interface DocumentNodeProps extends BaseNodeProps {
  label: 'DOCUMENT';
  documentId: string;         // may equal id if you want 1:1
  userId: string;
  title?: string;
  summary?: string;
  numChunks?: number;
  createdAt?: string;         // ISO datetime
}

export interface ChunkNodeProps extends BaseNodeProps {
  label: 'CHUNK';
  documentId: string;
  content: string;
  summary?: string;
  index: number;              // position within the document
  positions?: number[];       // optional token/char offsets
  // NOTE: id is same UUID as Embedding.id in PostgreSQL
}

export interface EntityNodeProps extends BaseNodeProps {
  label: 'ENTITY';
  documentId: string;
  name: string;
  type: string;               // 'EntityType' (user-configurable list)
  description?: string;
  aliases?: string[];
  context?: string;           // optional extraction context
  mentionCount?: number;
  firstSeenAt?: string;       // ISO datetime
  // NOTE: id is same UUID as GraphEntityEmbedding.id in PostgreSQL
}

export interface ConceptNodeProps extends BaseNodeProps {
  label: 'CONCEPT';
  documentId: string;
  name: string;
  type: string;               // 'ConceptType' (user-configurable list)
  description?: string;
  mentionCount?: number;
  // NOTE: id is same UUID as GraphConceptEmbedding.id in PostgreSQL
}

export type AnyNodeProps =
  | DocumentNodeProps
  | ChunkNodeProps
  | EntityNodeProps
  | ConceptNodeProps;

// ---------------------------------------------------------------------------
// Node TYPE schema (what properties are expected on each label)
// ---------------------------------------------------------------------------

export interface NodeTypeConfig {
  category: NodeCategory;                 // logical category
  label: string;                          // Neo4j label, e.g. "Entity"
  properties: Record<string, string>;    // property name -> type descriptor
}

// ---------------------------------------------------------------------------
// Edge TYPE schema (storage-level, not instance-level)
// ---------------------------------------------------------------------------

// Neo4j relationship types (what actually appears in the graph)
export type NeoEdgeType = 'IDENTITY' | 'SIMILAR' | 'RELATED' | 'HAS_CHUNK' | 'CONTAINS' | 'NEXT' | 'PREVIOUS';

// Internal config identifiers (TypeScript keys)
export type ResolutionEdgeName = 'IDENTITY' | 'SIMILAR' | 'RELATED_RESOLUTION';

// Relationship types that are created directly from extraction
export type ExtractionEdgeName =
  | 'HAS_CHUNK'          // Document -> Chunk
  | 'CONTAINS'           // Chunk -> Entity/Concept mention
  | 'RELATED_EXTRACTION' // Extracted semantic relation
  | 'NEXT'               // Chunk -> next Chunk (sequential order)
  | 'PREVIOUS';          // Chunk -> previous Chunk (sequential order)

export type EdgeName = ResolutionEdgeName | ExtractionEdgeName;

// Base schema for any edge TYPE
interface BaseEdgeTypeConfig {
  neoType: NeoEdgeType;                       // What appears in Neo4j
  defaultPhase: 'resolution' | 'extraction';  // Distinguishes purpose
  isSymmetric: boolean;                       // logical symmetry
  isTransitive: boolean;                      // logical transitivity
  allowedEndpoints: Array<[NodeCategory, NodeCategory]>; // structural constraint
  properties: Record<string, string>;         // instance properties (per-edge)
}

// Resolution edge TYPE schema (IDENTITY, SIMILAR, RELATED_RESOLUTION)
interface ResolutionEdgeTypeConfig extends BaseEdgeTypeConfig {
  defaultPhase: 'resolution';                 // resolution-phase edges
}

// Extraction edge TYPE schema (CONTAINS, HAS_CHUNK, RELATED_EXTRACTION)
interface ExtractionEdgeTypeConfig extends BaseEdgeTypeConfig {
  defaultPhase: 'extraction';                 // extraction-phase edges
}

export type AnyEdgeTypeConfig = ResolutionEdgeTypeConfig | ExtractionEdgeTypeConfig;

export interface StorageModelConfig {
  nodeTypes: Record<string, NodeTypeConfig>;
  edgeTypes: Record<EdgeName, AnyEdgeTypeConfig>;
}

export const storageModel: StorageModelConfig = {
  // -------------------------
  // Node type schema
  // -------------------------
  nodeTypes: {
    ENTITY: {
      category: 'ENTITY',
      label: 'Entity',
      properties: {
        id: 'string',                // Same UUID as GraphEntityEmbedding.id in PostgreSQL
        documentId: 'string',
        name: 'string',
        type: 'EntityType',
        description: 'string',
        aliases: 'string[]',
        context: 'string',
        mentionCount: 'number',
        firstSeenAt: 'datetime',
      },
    },
    CONCEPT: {
      category: 'CONCEPT',
      label: 'Concept',
      properties: {
        id: 'string',                // Same UUID as GraphConceptEmbedding.id in PostgreSQL
        documentId: 'string',
        name: 'string',
        type: 'ConceptType',
        description: 'string',
        mentionCount: 'number',
      },
    },
    DOCUMENT: {
      category: 'DOCUMENT',
      label: 'Document',
      properties: {
        id: 'string',
        documentId: 'string',     // may mirror id
        userId: 'string',
        title: 'string',
        summary: 'string',
        numChunks: 'number',
        createdAt: 'datetime',
      },
    },
    CHUNK: {
      category: 'CHUNK',
      label: 'Chunk',
      properties: {
        id: 'string',                // Same UUID as Embedding.id in PostgreSQL
        documentId: 'string',
        content: 'string',
        summary: 'string',
        index: 'number',
        positions: 'number[]',     // optional token/char offsets
      },
    },
  },

  // -------------------------
  // Edge type schema
  // -------------------------
  edgeTypes: {
    // Resolution edges ------------------------------------
    // NOTE: All resolution edges (IDENTITY, SIMILAR, RELATED_RESOLUTION) share
    // the SAME property schema. The only difference is the edge type name.
    //
    // Unified architecture:
    // 1. Candidate generation creates pool based on signals
    // 2. ONE LLM call per pair asks: "IDENTITY, SIMILAR, RELATED, or UNRELATED?"
    // 3. LLM returns edge type decision + metadata
    // 4. Policy filters which edge types are allowed per (from, to) pair
    // 5. All edges stored with same properties:
    //    - Core: confidence, decidedBy, rationale, policy
    //    - Signals: cosineSimScore, sharedAliases, sharedDoc
    //    - Metadata: phase, policyVersion, resolvedAt
    //
    // This avoids 3 separate LLM calls and ensures consistency.

    IDENTITY: {
      neoType: 'IDENTITY',
      defaultPhase: 'resolution',
      isSymmetric: true,
      isTransitive: true,
      allowedEndpoints: [
        ['ENTITY', 'ENTITY'],
        ['CONCEPT', 'CONCEPT'],
      ],
      properties: {
        // Core resolution-instance fields
        id: 'string',
        phase: 'string',              // 'resolution'
        confidence: 'number',
        decidedBy: 'string',          // 'llm' | 'human' | 'rule' | 'import'
        cosineSimScore: 'number',
        sharedAliases: 'string[]',
        sharedDoc: 'boolean',
        chunkProximity: 'number',
        rationale: 'string',
        policy: 'string',             // policy name or id
        policyVersion: 'string',
        resolvedAt: 'datetime',
      },
    },

    SIMILAR: {
      neoType: 'SIMILAR',
      defaultPhase: 'resolution',
      isSymmetric: true,
      isTransitive: false,
      allowedEndpoints: [
        ['CONCEPT', 'CONCEPT'],
        ['ENTITY', 'ENTITY'],          // schema allows; policy may disable
      ],
      properties: {
        id: 'string',
        phase: 'string',
        confidence: 'number',
        decidedBy: 'string',
        cosineSimScore: 'number',
        sharedAliases: 'string[]',
        sharedDoc: 'boolean',
        chunkProximity: 'number',
        rationale: 'string',
        policy: 'string',
        policyVersion: 'string',
        resolvedAt: 'datetime',
      },
    },

    RELATED_RESOLUTION: {
      // Resolution-phase RELATED edges: semantic relatedness decided by resolution
      neoType: 'RELATED',
      defaultPhase: 'resolution',
      isSymmetric: true,
      isTransitive: false,
      allowedEndpoints: [
        ['ENTITY', 'ENTITY'],
        ['CONCEPT', 'CONCEPT'],
        ['ENTITY', 'CONCEPT'],
        ['CONCEPT', 'ENTITY'],
      ],
      properties: {
        id: 'string',
        phase: 'string',
        confidence: 'number',
        decidedBy: 'string',
        cosineSimScore: 'number',
        sharedAliases: 'string[]',
        sharedDoc: 'boolean',
        chunkProximity: 'number',
        rationale: 'string',
        policy: 'string',
        policyVersion: 'string',
        resolvedAt: 'datetime',
      },
    },

    // Extraction edges ------------------------------------
    HAS_CHUNK: {
      neoType: 'HAS_CHUNK',           // Document -> Chunk
      defaultPhase: 'extraction',
      isSymmetric: false,
      isTransitive: false,
      allowedEndpoints: [
        ['DOCUMENT', 'CHUNK'],
      ],
      properties: {
        id: 'string',
        phase: 'string',              // 'extraction'
        confidence: 'number',         // optional
        index: 'number',               // position of the chunk within the document
      },
    },

    CONTAINS: {
      // CHUNK -> ENTITY/CONCEPT mentions
      neoType: 'CONTAINS',
      defaultPhase: 'extraction',
      isSymmetric: false,
      isTransitive: false,
      // Mentions within a chunk. Document -> Chunk is handled by HAS_CHUNK.
      allowedEndpoints: [
        ['CHUNK', 'ENTITY'],
        ['CHUNK', 'CONCEPT'],
      ],
      properties: {
        id: 'string',
        phase: 'string',              // 'extraction'
        confidence: 'number',
        mentionCount: 'number',
        positions: 'number[]',         // positions of mentions within chunk
      },
    },

    RELATED_EXTRACTION: {
      // RELATED extracted directly from text between co-occurring nodes.
      // Uses the generic RELATED label in Neo4j (same as RELATED_RESOLUTION).
      // Distinguished by phase='extraction' and has relationType property.
      neoType: 'RELATED',
      defaultPhase: 'extraction',
      isSymmetric: true,              // "related" treated as symmetric here
      isTransitive: false,
      allowedEndpoints: [
        ['ENTITY', 'ENTITY'],
        ['CONCEPT', 'CONCEPT'],
        ['ENTITY', 'CONCEPT'],
        ['CONCEPT', 'ENTITY'],
      ],
      properties: {
        id: 'string',
        phase: 'string',              // 'extraction'
        confidence: 'number',
        decidedBy: 'string',          // typically 'llm' or 'rule'
        relationType: 'string',       // e.g. 'WORKS_FOR', 'SUBSIDIARY_OF', etc.
        description: 'string',        // natural language description
        context: 'string',            // cue phrase / snippet from text
        documentId: 'string',
        chunkId: 'string',
      },
    },

    NEXT: {
      // Sequential ordering: Chunk -> next Chunk in document
      neoType: 'NEXT',
      defaultPhase: 'extraction',
      isSymmetric: false,
      isTransitive: false,
      allowedEndpoints: [
        ['CHUNK', 'CHUNK'],
      ],
      properties: {
        id: 'string',
        phase: 'string',              // 'extraction'
        overlapTokens: 'number',       // optional: number of overlapping tokens between chunks
      },
    },

    PREVIOUS: {
      // Reverse sequential ordering: Chunk -> previous Chunk in document
      neoType: 'PREVIOUS',
      defaultPhase: 'extraction',
      isSymmetric: false,
      isTransitive: false,
      allowedEndpoints: [
        ['CHUNK', 'CHUNK'],
      ],
      properties: {
        id: 'string',
        phase: 'string',              // 'extraction'
        overlapTokens: 'number',       // optional: number of overlapping tokens between chunks
      },
    },
  },
};
