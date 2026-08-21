// Bounds each vector and lexical candidate set before reciprocal-rank fusion.
export const CONVERSATION_SEARCH_CANDIDATE_POOL = 50;

// Dampens high-rank differences so vector and lexical results contribute evenly.
export const CONVERSATION_SEARCH_RRF_K = 60;

// Separates observed on-topic cosine scores (>= 0.56) from tangential matches (<= 0.33).
export const CONVERSATION_SEARCH_MIN_SIMILARITY = 0.45;

// Matches the established embedding batch size in graphBuilder.ts.
export const CONVERSATION_SIDECAR_EMBED_BATCH_SIZE = 50;

// Bounds only embedding-API input; stored and returned message text always remains complete.
export const CONVERSATION_SIDECAR_EMBED_MAX_CHARS = 48_000;
