// -----------------------------------------------------------------------------
// 3) resolution-policy.config.ts
// -----------------------------------------------------------------------------

import type { ResolutionEdgeName } from '@/features/graph-database/config/storage-model.config';
import type { NodeCategory } from '@/features/graph-database/config/storage-model.config';

export interface EdgeResolutionConfig {
  edgeType: ResolutionEdgeName;      // 'IDENTITY' | 'SIMILAR' | 'RELATED_RESOLUTION'
  enabled: boolean;                  // globally enabled for resolution
}

export interface TripleResolutionPolicy {
  edgeType: ResolutionEdgeName;
  from: NodeCategory;
  to: NodeCategory;
  enabled: boolean;                  // enabled for this (edgeType, from, to)
  worldKnowledgeAllowed: boolean;    // can LLM use prior knowledge?
  // NOTE: llmMode removed - unified prompt asks LLM to classify as IDENTITY/SIMILAR/RELATED/UNRELATED
  // LLM returns edge type decision, policy enables/disables allowed types per (from, to) pair
}

export interface ResolutionPolicyConfig {
  edges: EdgeResolutionConfig[];     // which resolution edges we use at all
  triples: TripleResolutionPolicy[]; // per-(edgeType, from, to) policy
  policyVersion: string;             // stamped onto created edges
}

export const resolutionPolicy: ResolutionPolicyConfig = {
  policyVersion: '2025-01-19',

  // Which resolution edge types are globally enabled
  edges: [
    { edgeType: 'IDENTITY', enabled: true },
    { edgeType: 'SIMILAR',  enabled: true },
    { edgeType: 'RELATED_RESOLUTION',  enabled: true },
  ],

  // Per-(edgeType, from, to) policy. This is where your current
  // "constitution" lives as *policy*, not as hard-coded schema.
  triples: [
    // ENTITY–ENTITY IDENTITY (strict, corpus-only)
    {
      edgeType: 'IDENTITY',
      from: 'ENTITY',
      to: 'ENTITY',
      enabled: true,
      worldKnowledgeAllowed: false,
    },

    // CONCEPT–CONCEPT IDENTITY (same abstract concept)
    {
      edgeType: 'IDENTITY',
      from: 'CONCEPT',
      to: 'CONCEPT',
      enabled: true,
      worldKnowledgeAllowed: false,
    },

    // ENTITY–ENTITY SIMILAR (currently disabled by policy, but schema allows it)
    {
      edgeType: 'SIMILAR',
      from: 'ENTITY',
      to: 'ENTITY',
      enabled: false,
      worldKnowledgeAllowed: false,
    },

    // CONCEPT–CONCEPT SIMILAR (primary concept similarity path)
    {
      edgeType: 'SIMILAR',
      from: 'CONCEPT',
      to: 'CONCEPT',
      enabled: true,
      worldKnowledgeAllowed: true,
    },

    // ENTITY–ENTITY RELATED (e.g. subsidiary, competitor, same holding group)
    {
      edgeType: 'RELATED_RESOLUTION',
      from: 'ENTITY',
      to: 'ENTITY',
      enabled: true,
      worldKnowledgeAllowed: true,
    },

    // CONCEPT–CONCEPT RELATED (looser than SIMILAR if you ever want it)
    {
      edgeType: 'RELATED_RESOLUTION',
      from: 'CONCEPT',
      to: 'CONCEPT',
      enabled: false,
      worldKnowledgeAllowed: true,
    },

    // ENTITY–CONCEPT RELATED (e.g. "AWS" related to "Cloud Computing")
    {
      edgeType: 'RELATED_RESOLUTION',
      from: 'ENTITY',
      to: 'CONCEPT',
      enabled: true,
      worldKnowledgeAllowed: true,
    },

    // CONCEPT–ENTITY RELATED (symmetric pair for completeness)
    {
      edgeType: 'RELATED_RESOLUTION',
      from: 'CONCEPT',
      to: 'ENTITY',
      enabled: true,
      worldKnowledgeAllowed: true,
    },
  ],
};
