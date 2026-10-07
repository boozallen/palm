import { logger } from '@/server/logger';
import { type GraphSchema } from './types';
import { general } from './general.schema';
import { GRAPH_SCHEMAS } from './registry';

export type { GraphSchema, PropertyDef, NodeTypeDef, EdgeTypeDef } from './types';
export { ANY_TYPE } from './types';
export { GRAPH_SCHEMAS } from './registry';

/**
 * Resolve a schema by key, falling back to `general` when the key is missing or
 * unknown. An unknown key is logged as a warning — we never invent a schema.
 *
 * Server-only (imports the Winston logger). Frontends that need the schema list
 * should import `GRAPH_SCHEMAS` from `./registry` instead.
 */
export function resolveSchema(key?: string): GraphSchema {
  if (!key) {
    return general;
  }

  const match = GRAPH_SCHEMAS.find((schema) => schema.key === key);
  if (!match) {
    logger.warn(`[GRAPH-EXTRACT] Unknown graph schema key "${key}"; falling back to "general".`);
    return general;
  }

  return match;
}
