/**
 * Build the subgraph to render for the current table selection of a pre-loaded graph
 * (enumeration results or an answer-evidence subgraph).
 *
 * `selectedEntityIds` are entity UUIDs — the table-checkbox space. Graph nodes carry that UUID at
 * `properties.id`, plus a separate numeric `id` that the edges reference. We keep the nodes whose
 * UUID is selected, then keep the edges whose both endpoints are kept.
 *
 * `edgeComplete` is the one behavioral difference between the two pre-loaded modes:
 *  - Enumeration (`true`): if an edge has exactly one selected endpoint, the OTHER endpoint is
 *    pulled in so the edge still renders — a "show the neighbors of what I selected" convenience.
 *  - Answer-evidence (`false`): the selection is authoritative. An unchecked node is never re-added,
 *    so unchecking a table row actually removes it from the canvas. The evidence graph is dense
 *    (nearly every node touches a selected one), so edge-completion there would re-add everything
 *    and make the checkboxes a no-op.
 */

type SubgraphNode = { id: number; properties?: { id?: string } };
type SubgraphEdge = { from: number; to: number };

export function buildSelectedSubgraph<N extends SubgraphNode, E extends SubgraphEdge>(
  graphData: { nodes: N[]; edges: E[] },
  selectedEntityIds: string[],
  edgeComplete: boolean,
): { nodes: N[]; edges: E[] } {
  const selectedUuids = new Set(selectedEntityIds);
  const nodes = graphData.nodes.filter(
    (n) => n.properties?.id !== undefined && selectedUuids.has(n.properties.id),
  );
  const keptNeoIds = new Set(nodes.map((n) => n.id));

  if (edgeComplete) {
    const byNeoId = new Map(graphData.nodes.map((n) => [n.id, n]));
    for (const edge of graphData.edges) {
      const hasFrom = keptNeoIds.has(edge.from);
      const hasTo = keptNeoIds.has(edge.to);
      if (hasFrom && !hasTo && byNeoId.has(edge.to)) {
        const missing = byNeoId.get(edge.to)!;
        nodes.push(missing);
        keptNeoIds.add(missing.id);
      } else if (!hasFrom && hasTo && byNeoId.has(edge.from)) {
        const missing = byNeoId.get(edge.from)!;
        nodes.push(missing);
        keptNeoIds.add(missing.id);
      }
    }
  }

  const edges = graphData.edges.filter((e) => keptNeoIds.has(e.from) && keptNeoIds.has(e.to));
  return { nodes, edges };
}
