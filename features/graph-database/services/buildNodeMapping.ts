/**
 * Maps a result row (and, where present, individual cells) to the graph node IDs
 * they represent, so the interactive table can drive graph brushing/selection.
 *
 * Cell-level mapping uses `_nodeId_<colName>` keys (current convention); the
 * row-level `_nodeId` / `_nodeIds` keys are the older fallback. This module is a
 * pure function with no external dependencies so it can be shared by both the
 * chat worker (legacy enumeration path) and the MCP cypher tool (agentic path).
 */

export type NodeMappingEntry = { rowIndex: number; colKey?: string; entityIds: string[] };

export function buildNodeMapping(rawResults: Record<string, unknown>[]): NodeMappingEntry[] {
  const mapping: NodeMappingEntry[] = [];

  for (let i = 0; i < rawResults.length; i++) {
    const row = rawResults[i];
    let foundCellLevel = false;

    for (const key of Object.keys(row)) {
      if (!key.startsWith('_nodeId_')) {continue;}
      const colKey = key.substring(8);
      const value = row[key];
      const entityIds: string[] = [];

      if (typeof value === 'string' && value) {
        entityIds.push(value);
      } else if (Array.isArray(value)) {
        for (const id of value) {
          if (typeof id === 'string' && id) {
            entityIds.push(id);
          }
        }
      }

      if (entityIds.length > 0) {
        mapping.push({ rowIndex: i, colKey, entityIds });
        foundCellLevel = true;
      }
    }

    if (!foundCellLevel) {
      const entityIds: string[] = [];
      const nodeId = row['_nodeId'];
      if (typeof nodeId === 'string' && nodeId) {
        entityIds.push(nodeId);
      }
      const nodeIds = row['_nodeIds'];
      if (Array.isArray(nodeIds)) {
        for (const id of nodeIds) {
          if (typeof id === 'string' && id) {
            entityIds.push(id);
          }
        }
      }
      if (entityIds.length > 0) {
        mapping.push({ rowIndex: i, entityIds });
      }
    }
  }

  return mapping;
}
