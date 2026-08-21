// Seed values only. Nothing at runtime is pinned to this model: an admin adds any
// model by hand and designates it embeddings-only from the provider table, and
// BedrockSource.createEmbeddings invokes whichever externalId it is handed. These
// exist so a fresh local install comes up with a working embedding model.
export const BEDROCK_TITAN_EMBEDDING_MODEL = 'amazon.titan-embed-text-v1';

export const BEDROCK_TITAN_EMBEDDING_MODEL_NAME = 'Titan Text Embeddings V1';

// $0.0001 per 1K input tokens = 1e-7 per token, per the AWS Bedrock price list
// (usage type TitanEmbeddingsG1-Text-input-tokens, us-east-1). Admins can edit
// this on the model row when AWS pricing changes.
export const BEDROCK_TITAN_EMBEDDING_COST_PER_INPUT_TOKEN = 0.0000001;

// Zero because AWS bills no output rate for embeddings: the response is a vector,
// not tokens, so there is no TitanEmbeddingsG1-Text-output-tokens usage type to
// price. BedrockSource.createEmbeddings never increments its output counter for
// the same reason. Named rather than inlined so the zero reads as the real rate
// instead of an unfilled placeholder. Admins editing the seeded row, or adding
// their own embedding model, set both rates on the model row.
export const BEDROCK_TITAN_EMBEDDING_COST_PER_OUTPUT_TOKEN = 0;
