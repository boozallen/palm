/**
 * Edge identity in UUID space for the answer-evidence subgraph.
 *
 * The renderer keys edges off Neo4j numeric ids (`getEdgeKey` in GraphVisualization), but the
 * table selection lives in UUID space (`properties.id`) so it survives reload and matches the
 * node-selection space. These helpers map an edge to a stable `srcUuid|relType|tgtUuid` key,
 * mirroring `getEdgeKey`'s `relationType || type` rule so the two identities round-trip.
 */

export type EdgeKeyNode = { id: number; properties?: { id?: string } };
export type EdgeKeyEdge = { from: number; to: number; type: string; properties?: { relationType?: string } };

export function evidenceEdgeKey(srcUuid: string, relType: string, tgtUuid: string): string {
  return `${srcUuid}|${relType}|${tgtUuid}`;
}

/**
 * Resolve an edge to its UUID-space key, or `null` when either endpoint is missing from the node
 * set (the edge can't be named/cited — skip it rather than mint a synthetic id).
 */
export function edgeToKey(edge: EdgeKeyEdge, nodeByNeoId: Map<number, EdgeKeyNode>): string | null {
  const src = nodeByNeoId.get(edge.from)?.properties?.id;
  const tgt = nodeByNeoId.get(edge.to)?.properties?.id;
  if (!src || !tgt) {
    return null;
  }
  const relType = edge.properties?.relationType || edge.type;
  return evidenceEdgeKey(src, relType, tgt);
}

/**
 * Every cited edge's UUID-space key, deduped and in `graphData.edges` order. Edges with an endpoint
 * outside the node set are dropped. Used to default-select all edges on a new evidence subgraph.
 */
export function allEdgeKeys(graphData: { nodes: EdgeKeyNode[]; edges: EdgeKeyEdge[] }): string[] {
  const byNeoId = new Map<number, EdgeKeyNode>(graphData.nodes.map((n) => [n.id, n]));
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const edge of graphData.edges) {
    const key = edgeToKey(edge, byNeoId);
    if (key === null || seen.has(key)) {
      continue;
    }
    seen.add(key);
    keys.push(key);
  }
  return keys;
}
