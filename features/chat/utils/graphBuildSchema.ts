import { suggestSchemaKey } from '@/features/graph-database/config/schemas/suggestSchemaKey';

type TypeById = Record<string, string | null | undefined>;

/**
 * Effective extraction schema per selected document. An explicit override wins;
 * otherwise the schema is suggested from the document's triaged `dataProfile.type`
 * (`suggestSchemaKey`, which falls back to `general` for null/unknown types).
 *
 * The result is keyed only by the currently selected `documentIds`, so a
 * deselected document drops out automatically and a newly-selected one picks up
 * its suggestion without any stored state.
 */
export function computeEffectiveSchemas(
  documentIds: string[],
  typeById: TypeById,
  overrides: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const id of documentIds) {
    result[id] = overrides[id] ?? suggestSchemaKey(typeById[id]);
  }
  return result;
}
