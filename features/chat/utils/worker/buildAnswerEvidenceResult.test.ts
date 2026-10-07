import { buildAnswerEvidenceResult } from './buildAnswerEvidenceResult';
import type { GraphSearchResultData } from '@/features/chat/types/message';
import type { CitedEdge } from '@/features/chat/utils/graphCitationHelpers';

type GraphData = NonNullable<GraphSearchResultData['graphData']>;
type GraphNode = GraphData['nodes'][number];

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 1,
    label: 'Acme Corp',
    labels: ['Organization'],
    properties: { id: 'uuid-1', type: 'ORGANIZATION', description: 'A company' },
    group: 'Organization',
    isAnchor: true,
    ...overrides,
  };
}

const noEdges: CitedEdge[] = [];

describe('buildAnswerEvidenceResult', () => {
  it('returns null when citedNodeIds is empty (no fetch)', async () => {
    const fetchGraphData = jest.fn();
    const result = await buildAnswerEvidenceResult([], noEdges, ['doc1'], fetchGraphData);
    expect(result).toBeNull();
    expect(fetchGraphData).not.toHaveBeenCalled();
  });

  it('returns null when the fetcher returns zero nodes', async () => {
    const fetchGraphData = jest.fn().mockResolvedValue({ nodes: [], edges: [] });
    const result = await buildAnswerEvidenceResult(['uuid-1'], noEdges, ['doc1'], fetchGraphData);
    expect(result).toBeNull();
  });

  it('returns null when the fetcher returns undefined', async () => {
    const fetchGraphData = jest.fn().mockResolvedValue(undefined);
    const result = await buildAnswerEvidenceResult(['uuid-1'], noEdges, ['doc1'], fetchGraphData);
    expect(result).toBeNull();
  });

  it('builds an evidence entry from cited nodes + cited edges (nodeMapping uses the node UUID)', async () => {
    const nodes: GraphNode[] = [
      makeNode({
        id: 10,
        label: 'Acme Corp',
        group: 'Organization',
        properties: { id: 'uuid-a', type: 'ORGANIZATION', description: 'A company' },
      }),
      makeNode({
        id: 20,
        label: 'DHS',
        group: 'Agency',
        properties: { id: 'uuid-b', category: 'GOV', description: '' },
      }),
    ];
    const edges: GraphData['edges'] = [
      { from: 10, to: 20, label: 'CONTRACTS_WITH', type: 'CONTRACTS_WITH', properties: {}, isShortestPath: false },
    ];
    const fetchGraphData = jest.fn().mockResolvedValue({ nodes, edges });
    const citedEdges: CitedEdge[] = [{ src: 'uuid-a', relType: 'CONTRACTS_WITH', tgt: 'uuid-b' }];

    const result = await buildAnswerEvidenceResult(['uuid-a', 'uuid-b'], citedEdges, ['doc1'], fetchGraphData);

    expect(result).not.toBeNull();
    expect(result!.kind).toBe('evidence');
    expect(result!.query).toBe('Answer evidence');
    expect(result!.rowCount).toBe(2);
    // only the cited edges are in the evidence graphData (fetcher already filtered)
    expect(result!.graphData).toEqual({ nodes, edges });

    // nodeMapping references the UUID space (properties.id, NOT the Neo4j numeric id).
    expect(result!.nodeMapping[0].entityIds).toEqual(['uuid-a']);
    expect(result!.nodeMapping[1].entityIds).toEqual(['uuid-b']);

    // rows are derived from node props; `type` falls back to `category` when absent.
    expect(result!.rows[0]).toEqual({ kind: 'Organization', name: 'Acme Corp', type: 'ORGANIZATION', description: 'A company' });
    expect(result!.rows[1]).toEqual({ kind: 'Agency', name: 'DHS', type: 'GOV', description: '' });

    expect(fetchGraphData).toHaveBeenCalledWith(['uuid-a', 'uuid-b'], citedEdges, ['doc1']);
  });

  it('carries a Chunk-labeled node through unchanged (label-agnostic) with a readable row', async () => {
    const nodes: GraphNode[] = [
      makeNode({
        id: 30,
        // buildGraphDataFromRecords' default label for a node with no name/title.
        label: 'Chunk-30',
        labels: ['Chunk'],
        group: 'Chunk',
        properties: { id: 'chunk-uuid', summary: 'Motor pools handle reservations.', documentId: 'doc1' },
      }),
    ];
    const fetchGraphData = jest.fn().mockResolvedValue({ nodes, edges: [] });

    const result = await buildAnswerEvidenceResult(['chunk-uuid'], noEdges, ['doc1'], fetchGraphData);

    expect(result).not.toBeNull();
    // nodeMapping is label-blind: the chunk UUID survives into the same UUID space as entities.
    expect(result!.nodeMapping[0].entityIds).toEqual(['chunk-uuid']);
    // The chunk row reads its text fields instead of yielding "Chunk-30" / empty type.
    expect(result!.rows[0]).toEqual({
      kind: 'Chunk',
      name: 'Motor pools handle reservations.',
      type: 'Chunk',
      description: 'Motor pools handle reservations.',
    });
  });
});
