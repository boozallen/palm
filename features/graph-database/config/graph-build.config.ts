/**
 * Per-request timeout (ms) for graph-build LLM calls (extraction + resolution).
 * A hung Bedrock request fails after this deadline and retryWithBackoff retries
 * it, instead of freezing the build indefinitely. Opt-in to graph-build paths
 * only — interactive graph chat is never timed out.
 */
export const GRAPH_BUILD_LLM_REQUEST_TIMEOUT_MS = 120_000;
