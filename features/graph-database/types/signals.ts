export type RulePhase = 'extraction' | 'resolution';

export interface Signal {
  name: string;
  enabled: boolean;
  defaultThreshold?: number;
}

export interface CandidateGenerationRule {
  name: string;
  requiredSignals: string[];
  thresholds: Record<string, number>;
  phase: RulePhase;
  action: 'merge' | 'link';
  enabled: boolean;
}

export interface AliasFilters {
  pronouns: string[];
  genericTerms: string[];
  scope: 'cross-document';
}

export interface CandidateLimits {
  useVectorIndex: boolean;
}

/**
 * Tunable parameters for the V2 blocking + cluster-based resolution algorithm.
 * All thresholds live here so there are no magic numbers in the algorithm code.
 */
export interface BlockingConfig {
  /** Min cosine similarity for an embedding-arm candidate edge (parity with embedding_similarity). */
  similarityThreshold: number;
  /** Keep an edge only if reciprocal in both nodes' neighbor sets (anti-chaining). */
  mutualKnn: boolean;
  /** Blocks larger than this are recursively split by tightening the threshold. */
  maxBlockSize: number;
  /** Nodes whose degree is at/above this percentile are treated as hubs and removed. */
  hubDegreePercentile: number;
  /** Blocks at/under this size use a single N-way partition LLM call. */
  smallBlockMaxForPartition: number;
  /** Anchor/leader batch size for large blocks (one LLM call per batch). */
  anchorBatchSize: number;
}

export interface SignalsConfig {
  signals: Signal[];
  candidateRules: CandidateGenerationRule[];
  aliasFilters: AliasFilters;
  candidateLimits: CandidateLimits;
  blocking: BlockingConfig;
}