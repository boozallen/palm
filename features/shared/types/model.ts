export type Model = {
  id: string;
  aiProviderId: string;
  name: string;
  externalId: string;
  costPerInputToken: number;
  costPerOutputToken: number;
  // Models that can only produce embeddings, never chat completions. Excluded
  // from every user-facing model picker and from system/knowledge-graph model
  // selection; reached only through AIFactory.buildEmbeddingSource().
  embeddingsOnly?: boolean;
};

export type AvailableModel = {
  providerLabel: string;
  aiProviderTypeId: number;
} & Model;
