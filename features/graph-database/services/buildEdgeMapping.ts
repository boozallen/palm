/**
 * Sibling of `buildNodeMapping`: maps each relationship-bearing result row to the
 * `(src, relType, tgt)` triple(s) it represents, so the write-time citation layer can
 * surface a stable `[[R#]]` handle for that edge and the worker can fetch exactly the
 * cited edges from Neo4j.
 *
 * A row is a relationship row when it carries ≥2 scalar `_nodeId_<col>` cells AND at least
 * one `_relType_<col>` cell (projected via the REL_TYPE_CONTRACT in `cypherSpecialist`).
 *
 * Endpoint rule (v1, documented intentionally): edges are emitted for ADJACENT `_nodeId_`
 * columns in their declared (RETURN) order. A 2-id row yields one edge; a path row with N ids
 * yields N-1 hops. Array-valued `_nodeId_` cells (from `collect(DISTINCT e.id)`) are
 * enumerations, not endpoints, so they are skipped here. When the per-hop relType count matches
 * the hop count they are zipped; otherwise the first relType is reused for every hop —
 * over-emission is harmless because the downstream Neo4j build matches `type(r) = e.type`.
 *
 * Pure function with no external dependencies (mirrors `buildNodeMapping.ts`).
 */

export type EdgeMappingEntry = { rowIndex: number; src: string; relType: string; tgt: string };

export function buildEdgeMapping(rawResults: Record<string, unknown>[]): EdgeMappingEntry[] {
  const mapping: EdgeMappingEntry[] = [];

  for (let i = 0; i < rawResults.length; i++) {
    const row = rawResults[i];

    // Collect scalar node ids and relationship types in column-declaration order.
    const nodeIds: string[] = [];
    const relTypes: string[] = [];
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (key.startsWith('_nodeId_')) {
        if (typeof value === 'string' && value) {
          nodeIds.push(value);
        }
      } else if (key.startsWith('_relType_')) {
        if (typeof value === 'string' && value) {
          relTypes.push(value);
        }
      }
    }

    if (nodeIds.length < 2 || relTypes.length === 0) {
      continue; // not a relationship row
    }

    const zipPerHop = relTypes.length === nodeIds.length - 1;
    const seen = new Set<string>();
    for (let p = 0; p < nodeIds.length - 1; p++) {
      const src = nodeIds[p];
      const tgt = nodeIds[p + 1];
      if (src === tgt) {
        continue;
      }
      const relType = zipPerHop ? relTypes[p] : relTypes[0];
      const dedupeKey = `${src}|${relType}|${tgt}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      mapping.push({ rowIndex: i, src, relType, tgt });
    }
  }

  return mapping;
}
