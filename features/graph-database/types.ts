// Neo4j Graph Database Types
// Domain types for graph database feature

import type { ResolutionEdgeName } from './config/storage-model.config';

// Graph build status for GraphMetadata table
export enum GraphBuildStatus {
  Pending = 'Pending',
  Building = 'Building',
  Resolving = 'Resolving',  // Between Building and Completed - entity resolution in progress
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelling = 'Cancelling', // Transient: cancel requested, worker rolling back at its next checkpoint
  Cancelled = 'Cancelled',   // Terminal: rolled back, no usable graph from this run
}

export enum NodeType {
  DOCUMENT = 'Document',
  CHUNK = 'Chunk',
  ENTITY = 'Entity',
  CONCEPT = 'Concept',
  USER = 'User',
}

export enum RelationshipType {
  // Document structure
  CONTAINS = 'CONTAINS',
  NEXT = 'NEXT',
  PREVIOUS = 'PREVIOUS',

  // Content relationships
  MENTIONS = 'MENTIONS',
  DISCUSSES = 'DISCUSSES',

  // Similarity
  SIMILAR_TO = 'SIMILAR_TO',

  // Cross-entity
  SUBCONCEPT_OF = 'SUBCONCEPT_OF',

  // User
  OWNS = 'OWNS',
  INTERESTED_IN = 'INTERESTED_IN',
}

export enum EntityType {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  LOCATION = 'LOCATION',
  TECHNOLOGY = 'TECHNOLOGY',
  DATE = 'DATE',
  PRODUCT = 'PRODUCT',
  DOCUMENT = 'DOCUMENT',  // Laws, regulations, standards, memos, policies
}

export enum ConceptCategory {
  TECHNICAL = 'TECHNICAL',
  BUSINESS = 'BUSINESS',
  DOMAIN_SPECIFIC = 'DOMAIN_SPECIFIC',
  GENERAL = 'GENERAL',
}

export enum GraphNodeLimits {
  DEFAULT = 300,
  MIN = 10,
  MAX = 5000,
}

export interface DocumentNode {
  id: string;
  filename: string;
  uploadStatus: string;
  createdAt: Date;
  userId: string;
  documentUploadProviderId: string;
  totalChunks: number;
  totalTokens: number;
}

export interface ChunkNode {
  id: string;
  content: string;
  contentNum: number;
  tokenCount: number;
  createdAt: Date;
  embeddingId: string; // Link back to PostgreSQL Embedding
  summary?: string;
  startPosition?: number | null; // Character position in document text
  endPosition?: number | null;   // Character position in document text
}

export interface EntityNode {
  id: string;
  name: string;
  type: string; // EntityType enum preferred, but allows LLM to return other values
  normalizedName: string;
  mentionCount: number;
  firstSeenAt: Date;
  description: string;
  aliases: string[];
  documentId: string;
  // Note: context is now on the MENTIONS edge (per-mention), not on the Entity node
}

export interface ConceptNode {
  id: string;
  name: string;
  category: ConceptCategory;
  description: string;
  mentionCount: number;
  documentId: string;
  firstSeenAt: Date;
}

// Relationship properties

export interface ContainsRelationship {
  position: number;
}

export interface NextRelationship {
  overlapTokens: number;
}

export interface MentionsRelationship {
  count: number;
  positions: number[];
  confidence: number;
  context: string; // Context snippet where the entity is mentioned (moved from EntityNode)
}

export interface DiscussesRelationship {
  relevance: number;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  context: string;
}

export interface SimilarToRelationship {
  score: number;
  reason?: string;
}

export interface RelatesToRelationship {
  cooccurrenceCount: number;
  relationship?: string;
}

// Entity extraction result

export interface ExtractedEntity {
  text: string;
  type: string; // EntityType enum preferred, but allows LLM to return other values
  positions: number[];
  confidence: number;
  description: string;
  aliases: string[];
  context: string;
  // Schema-driven custom properties (CUSTOM_GRAPH_SCHEMA). Optional so the
  // legacy extraction path and existing tests compile unchanged.
  properties?: Record<string, string | number | boolean>;
}

export interface ExtractedConcept {
  name: string;
  category: ConceptCategory;
  relevance: number;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  description: string;
  context: string;
  properties?: Record<string, string | number | boolean>;
}

export interface ExtractedRelationship {
  source: string;              // Entity/Concept name (source)
  target: string;              // Entity/Concept name (target)
  relationType: string;        // 'WORKS_FOR', 'PART_OF', etc.
  description: string;         // Natural language description
  context: string;             // Text snippet containing relationship
  confidence: number;          // 0.0 to 1.0
  properties?: Record<string, string | number | boolean>;
}

export interface ChunkAnalysis {
  chunkId: string;
  content: string;
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
  relationships: ExtractedRelationship[];
  summary: string;
  documentId: string;
}

// F2.1-F2.3: Signal Computation and Candidate Generation Types

/**
 * Entity type for signal computation (alias for EntityNode)
 * Used in candidate generation pipeline
 */
export type Entity = EntityNode;

/**
 * Concept type for signal computation (alias for ConceptNode)
 * Used in candidate generation pipeline for concept resolution
 */
export type Concept = ConceptNode;

/**
 * Signal vector containing similarity metrics for entity pair
 * F2.1: Signal Computation
 */
export interface SignalVector {
  embedding_similarity: number;         // 0.0-1.0 (from pgvector query)
  has_name_alias_overlap: boolean;      // Any overlap in [name + aliases]
  same_name: boolean;                   // Main names match (normalized)
  same_type: boolean;                   // Entity types match (PERSON, ORG, etc.)
  same_document: boolean;               // From same document
  sharedNames?: string[];               // For debugging/provenance (overlapping names/aliases)
}

/**
 * Candidate pair for resolution
 * F2.2: Candidate Generation
 * F2.7: Extended to support both Entity and Concept nodes
 */
export interface CandidatePair {
  entity1: Entity | Concept;
  entity2: Entity | Concept;
  signals: SignalVector;
  rule: string;                    // Which filtering rule qualified this pair (e.g., 'same_doc_same_name')
}

/**
 * Resolution result from LLM decision
 * F2.4: Resolution Policy Executor
 * F2.7: Extended to support both Entity and Concept nodes
 */
export interface Resolution {
  entity1: Entity | Concept;
  entity2: Entity | Concept;
  edgeType: ResolutionEdgeName | 'UNRELATED';
  confidence: number;
  rationale: string;
  // 'llm' for model-judged edges; 'transitivity_fix' for the free bridging
  // IDENTITY edges emitted by V2 confirmed-edge closure.
  decidedBy: 'llm' | 'transitivity_fix';
  signals: {
    cosineSimScore: number;
    sharedAliases?: string[];
    sharedDoc: boolean;
  };
  policy: string;
  policyVersion: string;
  resolvedAt: Date;
}

// F2.6: Transitivity Validation Types

/**
 * Represents a transitivity violation in IDENTITY edges
 * F2.6: Transitivity Validation
 *
 * Detected when: A-IDENTITY-B and B-IDENTITY-C exist, but A-IDENTITY-C is missing
 * IDENTITY is transitive: if A=B and B=C, then A=C must be true
 */
export interface TransitivityViolation {
  entity1: Entity;           // First entity in chain
  middleEntity: Entity;      // Middle entity connecting them
  entity2: Entity;           // Third entity in chain
  existingEdges: {
    edge1: {                 // entity1 - middleEntity edge
      confidence: number;
      rationale: string;
    };
    edge2: {                 // middleEntity - entity2 edge
      confidence: number;
      rationale: string;
    };
  };
  // Mention contexts from MENTIONS relationships - shows how each entity is used in the document
  // This helps the LLM evaluate whether the original IDENTITY edges were correct
  mentionContexts?: {
    entity1Contexts: string[];      // Contexts where entity1 is mentioned
    middleEntityContexts: string[]; // Contexts where middleEntity is mentioned
    entity2Contexts: string[];      // Contexts where entity2 is mentioned
  };
}

/**
 * Action to take when fixing a transitivity violation
 * F2.6: Transitivity Validation
 */
export enum ViolationResolutionAction {
  CREATE_EDGE = 'create_edge',      // Create missing A-C edge
  REMOVE_EDGE_1 = 'remove_edge_1',  // Remove A-B edge (it's wrong)
  REMOVE_EDGE_2 = 'remove_edge_2',  // Remove B-C edge (it's wrong)
  UNCERTAIN = 'uncertain',           // Can't decide, needs human review
}

/**
 * LLM decision on how to fix a transitivity violation
 * F2.6: Transitivity Validation
 */
export interface ViolationResolution {
  action: ViolationResolutionAction;
  confidence: number;
  rationale: string;
}

/**
 * Summary statistics for transitivity validation run
 * F2.6: Transitivity Validation
 */
export interface ValidationSummary {
  violationsFound: number;
  violationsFixed: number;
  violationsUncertain: number;
  actions: {
    created: number;    // Edges created
    removed: number;    // Edges deleted
  };
}

// ============================================
// F8.2: GRAPH STATS TRACKING TYPES
// ============================================

/**
 * Run type for graph build operations
 */
export type GraphBuildRunType = 'extraction' | 'resolution' | 'transitivity';

/**
 * Status of a graph build run
 */
export type GraphBuildRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Warning severity levels
 */
export type WarningSeverity = 'info' | 'warning' | 'error';

/**
 * Health check warning generated during graph build operations
 */
export interface BuildRunWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Warning codes and their meanings
 */
export const WARNING_CODES = {
  // Resolution warnings
  DOC_PAIR_MISMATCH: 'DOC_PAIR_MISMATCH',
  DUPLICATE_RESOLUTIONS: 'DUPLICATE_RESOLUTIONS',
  LOW_CONFIDENCE_IDENTITY: 'LOW_CONFIDENCE_IDENTITY',
  ALL_SAME_DECISION: 'ALL_SAME_DECISION',
  HIGH_UNRELATED_RATIO: 'HIGH_UNRELATED_RATIO',

  // Transitivity warnings
  VIOLATIONS_INCREASING: 'VIOLATIONS_INCREASING',
  VIOLATIONS_NOT_IMPROVING: 'VIOLATIONS_NOT_IMPROVING',
  HIGH_UNCERTAIN_RATIO: 'HIGH_UNCERTAIN_RATIO',

  // Extraction warnings
  NO_ENTITIES_EXTRACTED: 'NO_ENTITIES_EXTRACTED',
  LOW_ENTITY_COUNT: 'LOW_ENTITY_COUNT',
} as const;

export type WarningCode = typeof WARNING_CODES[keyof typeof WARNING_CODES];

/**
 * Per-document extraction stats
 */
export interface DocumentExtractionStats {
  entities: number;
  concepts: number;
  chunks: number;
  extractedAt?: string;
}

/**
 * Stats for an extraction run
 */
export interface ExtractionRunStats {
  chunksProcessed: number;
  entitiesCreated: number;
  entitiesMerged: number;
  conceptsCreated: number;
  relationshipsCreated: number;
  /** Chunk ids whose extraction failed after retries and were skipped (resumable path only) */
  skippedChunkIds?: string[];
  byDocument: Record<string, DocumentExtractionStats>;
}

/**
 * Decision breakdown by type
 */
export interface DecisionBreakdown {
  identity: number;
  similar: number;
  related: number;
  unrelated: number;
}

/**
 * Entity type stats for resolution
 */
export interface EntityTypeResolutionStats {
  identity: number;
  similar: number;
  unrelated: number;
}

/**
 * Stats for a resolution run
 */
export interface ResolutionRunStats {
  // Core metrics
  candidatesGenerated: number;
  // Count of confirmed IDENTITY decisions this run — one per :IDENTITY
  // Resolution object, matching 1:1 what persistResolutions writes to Neo4j.
  // Under V2 representative collapse (see
  // .agents/plans/entity-resolution-identity-cluster-hubs.md), this no
  // longer scales with cluster size: a new node joining an N-member cluster
  // produces exactly one edge/decision, not N.
  identityEdges: number;
  similarEdges: number;
  relatedEdges: number;
  unrelatedPairs: number;

  // Incremental tracking
  expectedDocPairs: number;
  actualDocPairs: number;
  duplicateResolutions: number;

  // Confidence metrics
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  lowConfidenceIdentityCount: number;

  // Decision distribution
  decisionBreakdown: DecisionBreakdown;

  // By entity type
  byEntityType: Record<string, EntityTypeResolutionStats>;
}

/**
 * Union type for run stats based on run type
 */
export type RunStats = ExtractionRunStats | ResolutionRunStats;

/**
 * Aggregated extraction stats for GraphMetadata
 */
export interface GraphExtractionStats {
  totalEntities: number;
  totalConcepts: number;
  totalChunks: number;
  byDocument: Record<string, DocumentExtractionStats>;
}

/**
 * Aggregated resolution stats for GraphMetadata
 */
export interface GraphResolutionStats {
  // Cumulative count of confirmed IDENTITY decisions across all runs — see
  // ResolutionRunStats.identityEdges for what one run's count means under
  // V2 representative collapse.
  totalIdentityEdges: number;
  totalSimilarEdges: number;
  totalCandidatesEvaluated: number;
  documentPairsResolved: number;
  lastRunAt: string;
}

/**
 * Aggregated transitivity stats for GraphMetadata
 */
export interface GraphTransitivityStats {
  totalViolationsFixed: number;
  currentViolations: number;
  lastCheckedAt: string;
}

/**
 * Complete stats object stored in GraphMetadata.stats
 */
export interface GraphMetadataStats {
  extraction: GraphExtractionStats;
  resolution: GraphResolutionStats;
  transitivity: GraphTransitivityStats;
}

/**
 * Parameters for creating a graph build run
 */
export interface CreateBuildRunParams {
  graphId: string;
  userId: string;
  runType: GraphBuildRunType;
  documentIds: string[];
  isIncremental: boolean;
  newDocumentIds: string[];
  existingDocumentIds: string[];
}

/**
 * Parameters for completing a graph build run
 */
export interface CompleteBuildRunParams {
  runId: string;
  stats: RunStats;
  warnings: BuildRunWarning[];
}

/**
 * Parameters for marking a document pair as resolved
 */
export interface MarkResolvedParams {
  document1Id: string;
  document2Id: string;
  userId: string;
  candidatesGenerated: number;
  identityEdgesCreated: number;
  similarEdgesCreated: number;
  relatedEdgesCreated: number;
}
