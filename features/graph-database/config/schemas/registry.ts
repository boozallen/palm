import { type GraphSchema } from './types';
import { general } from './general.schema';
import { governmentPursuit } from './government-pursuit.schema';

/**
 * Registry of all selectable extraction schemas. `general` is the default and
 * must remain first.
 *
 * This module is intentionally free of server-only imports (no logger) so it is
 * safe to import from frontend components (e.g. the build-time schema picker).
 */
export const GRAPH_SCHEMAS: GraphSchema[] = [general, governmentPursuit];

/**
 * Human-readable label for a recorded schema key, falling back to the raw key
 * for anything not in the registry.
 */
export function schemaDisplayName(key: string | null | undefined): string {
  if (!key) {
    return '—';
  }
  return GRAPH_SCHEMAS.find((s) => s.key === key)?.name ?? key;
}
