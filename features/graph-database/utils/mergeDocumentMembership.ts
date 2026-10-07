/**
 * Compute a graph's stored document membership after a build run.
 *
 * Membership only ever GROWS: the result is the de-duplicated, sorted union of
 * the row's prior membership and the documents this run processed. The worker
 * must derive membership this way — reading the row's current `documentIds` and
 * unioning — and never from the queued job payload. On an incremental build that
 * payload carries only the resolution base (`existingDocumentIds`), which is
 * empty until documents are resolution-marked; recomputing from it truncates the
 * stored membership and drops every previously-graphed document.
 */
export function mergeDocumentMembership(
  priorDocumentIds: string[],
  processedDocumentIds: string[]
): string[] {
  return Array.from(new Set([...priorDocumentIds, ...processedDocumentIds])).sort();
}
