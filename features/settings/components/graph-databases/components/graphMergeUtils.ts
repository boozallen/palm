/**
 * Merge base graph data (from queries) with interactive nodes (from Connect/Expand).
 * Base nodes take precedence — if a node exists in both, the base version wins.
 * Interactive nodes that were explicitly removed are excluded.
 */
export function mergeBaseWithInteractive(
  prevGraphData: { nodes: any[]; edges: any[] },
  newBaseData: { nodes: any[]; edges: any[] },
  removedNodeIds: Set<number>,
): { nodes: any[]; edges: any[] } {
  // Extract interactive nodes/edges from previous state
  const interactiveNodes = prevGraphData.nodes.filter(
    (n: any) => n.isInteractive && !removedNodeIds.has(n.id)
  );
  const interactiveEdges = prevGraphData.edges.filter((e: any) => e.isInteractive);

  // Merge: base first, then interactive (dedup by ID — base wins)
  const baseNodeIds = new Set(newBaseData.nodes.map(n => n.id));
  const mergedNodes = [
    ...newBaseData.nodes,
    ...interactiveNodes.filter(n => !baseNodeIds.has(n.id)),
  ];

  // Merge edges: only include interactive edges whose endpoints are in the merged node set
  const allNodeIds = new Set(mergedNodes.map(n => n.id));
  const baseEdgeKeys = new Set(newBaseData.edges.map(e => `${e.from}-${e.to}-${e.type}`));
  const mergedEdges = [
    ...newBaseData.edges,
    ...interactiveEdges.filter(e =>
      allNodeIds.has(e.from) && allNodeIds.has(e.to) &&
      !baseEdgeKeys.has(`${e.from}-${e.to}-${e.type}`)
    ),
  ];

  return { nodes: mergedNodes, edges: mergedEdges };
}
