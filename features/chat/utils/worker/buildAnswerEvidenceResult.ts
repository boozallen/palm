import type { GraphSearchResultData } from '@/features/chat/types/message';
import type { CitedEdge } from '@/features/chat/utils/graphCitationHelpers';

/**
 * Turns the write-time citations (the node UUIDs + relationship triples the answer cites) into one
 * "evidence" `GraphSearchResultData`: exactly the cited nodes + ONLY the cited edges, plus a table
 * whose rows map back to the same UUID space so row selection drives the canvas.
 *
 * The graph fetcher is INJECTED (not imported) so this stays a pure, unit-testable helper — the
 * worker passes its private `fetchCitedEvidenceGraph`, which fetches the cited nodes and matches
 * each cited triple as an edge (NOT every edge between the nodes). The docs parameter is generic so
 * the worker can pass its branded `AccessibleDocIds` while tests pass a plain value.
 */
export async function buildAnswerEvidenceResult<D>(
  citedNodeIds: string[],
  citedEdges: CitedEdge[],
  accessibleDocIds: D,
  fetchGraphData: (nodeIds: string[], edges: CitedEdge[], docs: D) => Promise<GraphSearchResultData['graphData']>,
): Promise<GraphSearchResultData | null> {
  if (citedNodeIds.length === 0) {
    return null;
  }

  const graphData = await fetchGraphData(citedNodeIds, citedEdges, accessibleDocIds);
  if (!graphData || graphData.nodes.length === 0) {
    return null;
  }

  // Rows are label-agnostic, but a Chunk node carries no `name`/`type`/`description` — its text
  // lives in `summary`/`content` — so the generic mapping would yield a useless `Chunk-<neoId>`
  // name + empty type. Read chunk text fields explicitly so any-label nodes (chunks, future
  // path nodes) land in the table readable.
  const rows = graphData.nodes.map((n) => {
    if (n.labels?.includes('Chunk')) {
      const text = String(n.properties?.summary ?? n.properties?.content ?? '');
      return { kind: n.group, name: text || 'Passage', type: 'Chunk', description: text };
    }
    return {
      kind: n.group,
      name: n.label,
      type: String(n.properties?.type ?? n.properties?.category ?? ''),
      description: String(n.properties?.description ?? ''),
    };
  });

  // `n.properties.id` is the UUID (= graphEntityId / graphConceptId / nodeMapping.entityIds
  // space), NOT `n.id` (the Neo4j numeric id used only by the renderer). Mapping the table
  // checkbox back to this UUID is what lets row selection drive the graph canvas.
  const nodeMapping = graphData.nodes.map((n, rowIndex) => ({
    rowIndex,
    entityIds: [String(n.properties?.id)],
  }));

  return {
    query: 'Answer evidence',
    generatedCypher: '',
    rowCount: graphData.nodes.length,
    rows,
    nodeMapping,
    graphData,
    kind: 'evidence',
  };
}
