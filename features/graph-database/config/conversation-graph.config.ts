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

// Bounds each page of prior-conversation search results.
export const CONVERSATION_SEARCH_PAGE_SIZE = 10;

// Page size for get_conversation_artifact content. Pagination, never truncation:
// the tool reports contentLength + nextCursor and the model pulls more pages on demand.
export const CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS = 30_000;

// First slice of each artifact's text (extracted from Office files when the content column is
// empty), returned by find_artifacts so the model can break title ties without fetching. A preview by design, not truncation: the full content is
// one get_conversation_artifact call away.
export const ARTIFACT_PREVIEW_CHARS = 200;

// Bounds each page of artifact metadata returned by find_artifacts.
export const ARTIFACT_SEARCH_PAGE_SIZE = 20;

// Sets the recent-conversation lookback when the caller does not provide one.
export const RECENT_CONVERSATIONS_DEFAULT_SINCE_DAYS = 14;

// Bounds each page of recent-conversation summaries.
export const RECENT_CONVERSATIONS_PAGE_SIZE = 20;

// Bounds the most frequently cited entities returned for each conversation.
export const RECENT_CONVERSATIONS_TOP_ENTITY_LIMIT = 5;

// Bounds the combined id/name filters accepted per entity lookup. Exceeding
// it returns an explicit error naming the limit — never silent truncation —
// and logs, so a runaway caller cannot fan a request out into per-name scans.
export const CONVERSATION_ENTITY_FILTER_LIMIT = 25;

// Bounds how many conversations an entity/concept lookup returns.
export const CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT = 20;

// Bounds the matched messages listed per conversation in an entity/concept lookup.
export const CONVERSATIONS_FOR_ENTITIES_MATCHES_PER_CHAT = 20;
