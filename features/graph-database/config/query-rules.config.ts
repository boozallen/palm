// -----------------------------------------------------------------------------
// 4) query-rules.config.ts
// -----------------------------------------------------------------------------

import type { ResolutionEdgeName } from '@/features/graph-database/config/storage-model.config';

export interface QueryProfile {
  name: string;
  // Which resolution edges count as "identity" when clustering
  identityEdges: ResolutionEdgeName[];
  // Which edges are used for neighborhood expansion
  neighborhoodEdges: ResolutionEdgeName[];
  // Minimum scores per edge type
  minScore: Partial<Record<ResolutionEdgeName, number>>;
  // Whether to include edges created under worldKnowledgeAllowed=true
  includeWorldKnowledgeEdges: boolean;
  // Hop limits
  maxIdentityHops: number;
  maxNeighborhoodHops: number;
}

export interface QueryRulesConfig {
  profiles: QueryProfile[];
}

export const queryRules: QueryRulesConfig = {
  profiles: [
    {
      name: 'strict_identity_corpus_only',
      identityEdges: ['IDENTITY'],
      neighborhoodEdges: [],
      minScore: { IDENTITY: 0.9 },
      includeWorldKnowledgeEdges: false,
      maxIdentityHops: 10,
      maxNeighborhoodHops: 0,
    },
    {
      name: 'semantic_exploration',
      identityEdges: ['IDENTITY'],
      neighborhoodEdges: ['SIMILAR', 'RELATED_RESOLUTION'],
      minScore: { IDENTITY: 0.8, SIMILAR: 0.7, RELATED_RESOLUTION: 0.7 },
      includeWorldKnowledgeEdges: true,
      maxIdentityHops: 10,
      maxNeighborhoodHops: 2,
    },
  ],
};
