import { GOVERNMENT_PURSUIT_SCHEMA_TYPES_NORMALIZED } from 'features/settings/types/graph-database';

/**
 * Derives the suggested extraction schema from a document's free-text
 * `documentType` (produced by ingest triage). This is a pure mapping — NOT a
 * separate LLM call — and is intentionally free of server-only imports so it can
 * run in the build-time schema picker on the frontend.
 *
 * The two selectable schemas are binary (`general` | `government-pursuit`, see
 * `registry.ts`). A document is suggested for `government-pursuit` when its type
 * matches a solicitation artifact from the canonical docType vocabulary
 * (`government-pursuit.schema.ts` SourceDocument.docType). Anything else — a
 * recipe, a memo, an unknown type, or `null` — falls back to `general`.
 */

export type SuggestedSchemaKey = 'general' | 'government-pursuit';

export function suggestSchemaKey(documentType: string | null | undefined): SuggestedSchemaKey {
  if (!documentType) {
    return 'general';
  }

  // Normalize: lowercase, collapse internal whitespace, trim.
  const normalized = documentType.toLowerCase().replace(/\s+/g, ' ').trim();

  return GOVERNMENT_PURSUIT_SCHEMA_TYPES_NORMALIZED.has(normalized) ? 'government-pursuit' : 'general';
}
