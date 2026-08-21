import { SignalsConfig } from '@/features/graph-database/types/signals';

export const signalsConfig: SignalsConfig = {
  signals: [
    { name: 'embedding_similarity', enabled: true, defaultThreshold: 0.8 },
    { name: 'alias_overlap',        enabled: true, defaultThreshold: 0.2 },
    { name: 'exact_name_match',     enabled: true },
    { name: 'same_document',        enabled: true },
  ],

  candidateRules: [
    // ==========================================================================
    // EXTRACTION PHASE RULES (merge entities during extraction)
    // These prevent duplicate nodes from being created within the same document
    // ==========================================================================

    // Rule 1: Same document + exact same name → merge into one node
    {
      name: 'same_doc_same_name',
      requiredSignals: ['same_document', 'exact_name_match'],
      thresholds: { same_document: 1, exact_name_match: 1 },
      phase: 'extraction',
      action: 'merge',
      enabled: true,
    },

    // Rule 2: Same document + alias overlap + same type → merge into one node
    // e.g., "DHA" (ORG) and "Defense Health Agency" (ORG) with shared alias
    // CONSERVATIVE: Requires same type to avoid merging e.g. "JFK" (PERSON) with "JFK Airport" (LOCATION)
    {
      name: 'same_doc_alias_overlap',
      requiredSignals: ['same_document', 'alias_overlap', 'same_type'],
      thresholds: { same_document: 1, alias_overlap: 0.1, same_type: 1 },
      phase: 'extraction',
      action: 'merge',
      enabled: true,
    },

    // ==========================================================================
    // RESOLUTION PHASE RULES (link entities during LLM resolution)
    // These create IDENTITY edges between entities (cross-doc OR intra-doc missed by extraction)
    // ==========================================================================

    // Rule 3: Exact same name → candidate for LLM resolution
    // Applies both cross-doc and intra-doc (safety net for missed extraction merges)
    {
      name: 'same_name',
      requiredSignals: ['exact_name_match'],
      thresholds: { exact_name_match: 1 },
      phase: 'resolution',
      action: 'link',
      enabled: true,
    },

    // Rule 4: Alias overlap + high embedding similarity → candidate for LLM
    // Applies both cross-doc and intra-doc (safety net for missed extraction merges)
    {
      name: 'alias_overlap_high_embedding',
      requiredSignals: ['alias_overlap', 'embedding_similarity'],
      thresholds: {
        alias_overlap: 0.1,           // Any overlap
        embedding_similarity: 0.8,    // High similarity required
      },
      phase: 'resolution',
      action: 'link',
      enabled: true,
    },

    // Rule 5: Very high embedding similarity alone → candidate for LLM
    // Catches cases where aliases weren't extracted properly (e.g., "USA" ↔ "United States of America")
    // Very high threshold (0.95) to minimize false positives from related-but-distinct entities
    {
      name: 'very_high_embedding',
      requiredSignals: ['embedding_similarity'],
      thresholds: {
        embedding_similarity: 0.95,   // Very high similarity required
      },
      phase: 'resolution',
      action: 'link',
      enabled: true,
    },
  ],

  // Generic alias filtering policy
  aliasFilters: {
    // Pronouns - always filter from cross-document matching
    pronouns: [
      'it', 'they', 'he', 'she', 'him', 'her', 'them',
      'this', 'that', 'these', 'those', 'we', 'us', 'our',
    ],

    // Generic organizational references - filter from cross-document matching
    // Within-document: useful ("the agency" = specific context)
    // Cross-document: too ambiguous ("the agency" could mean different orgs)
    genericTerms: [
      'the agency', 'the organization', 'the company', 'the firm',
      'the department', 'the office', 'the bureau', 'the division',
      'the team', 'the group', 'the committee', 'the administration',
      'the government', 'the authority', 'the board', 'the council',
    ],

    // Apply filters only for cross-document candidate generation
    // Within-document: keep all aliases (context-specific)
    scope: 'cross-document',
  },

  // Candidate generation settings
  candidateLimits: {
    // Require pgvector HNSW/IVFFlat index for similarity search
    // Fail if index missing (prevents accidental O(n²) queries)
    useVectorIndex: true,
  },

  // V2 blocking + cluster-based resolution parameters (all tunable here).
  // similarityThreshold defaults to the embedding_similarity gate (0.8) so the
  // V2 candidate threshold is byte-comparable with the legacy pairwise path.
  blocking: {
    similarityThreshold: 0.8,
    mutualKnn: true,
    maxBlockSize: 30,
    hubDegreePercentile: 0.99,
    smallBlockMaxForPartition: 8,
    anchorBatchSize: 20,
  },
};
