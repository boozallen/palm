/**
 * Build the answer-evidence subgraph to render from the two checked sets — checked node UUIDs and
 * checked edge keys. This is the two-axis sibling of `buildSelectedSubgraph`: enumeration uses that
 * (edge-completion), evidence uses this (an independent edge axis with endpoint integrity).
 *
 * Render rule:
 *  - `N = nodes whose properties.id ∈ checkedNodeUuids`
 *  - `E = edges whose key ∈ checkedEdgeKeys AND both endpoints ∈ N` (endpoint integrity — an edge
 *    never renders without both endpoints, so unchecking a node drops its edges)
 *
 * Selection is UUID space throughout (the table-checkbox space); the numeric `id` is only the
 * edge-reference bridge.
 */
import { edgeToKey } from './graphEdgeKey';

type SubgraphNode = { id: number; properties?: { id?: string } };
type SubgraphEdge = { from: number; to: number; type: string; properties?: { relationType?: string } };

export function buildEvidenceSubgraph<N extends SubgraphNode, E extends SubgraphEdge>(
  graphData: { nodes: N[]; edges: E[] },
  checkedNodeUuids: string[],
  checkedEdgeKeys: string[],
): { nodes: N[]; edges: E[] } {
  const nodeSet = new Set(checkedNodeUuids);
  const edgeSet = new Set(checkedEdgeKeys);

  const nodes = graphData.nodes.filter(
    (n) => n.properties?.id !== undefined && nodeSet.has(n.properties.id),
  );
  const keptUuids = new Set(nodes.map((n) => n.properties!.id!));
  const byNeoId = new Map<number, N>(graphData.nodes.map((n) => [n.id, n]));

  const edges = graphData.edges.filter((e) => {
    const key = edgeToKey(e, byNeoId);
    if (key === null || !edgeSet.has(key)) {
      return false;
    }
    const src = byNeoId.get(e.from)?.properties?.id;
    const tgt = byNeoId.get(e.to)?.properties?.id;
    return !!src && !!tgt && keptUuids.has(src) && keptUuids.has(tgt);
  });

  return { nodes, edges };
}
