import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SubgraphInspector from './SubgraphInspector';
import { GraphSearchResultData } from '@/features/chat/types/message';
import { renderWrapper } from '@/test/test-utils';

type GraphData = NonNullable<GraphSearchResultData['graphData']>;
type GraphNode = GraphData['nodes'][number];
type GraphEdge = GraphData['edges'][number];

const node = (id: number, label: string, uuid: string): GraphNode => ({
  id,
  label,
  labels: ['Entity'],
  properties: { id: uuid },
  group: 'Entity',
  isAnchor: true,
});

const edge = (from: number, to: number, type: string): GraphEdge => ({
  from,
  to,
  label: type,
  type,
  properties: {},
  isShortestPath: false,
});

const data: GraphSearchResultData = {
  query: 'Answer evidence',
  generatedCypher: '',
  rowCount: 2,
  rows: [
    { kind: 'Entity', name: 'CISA', type: 'agency', description: 'A cyber agency' },
    { kind: 'Entity', name: 'Acme', type: 'company', description: 'A contractor' },
  ],
  nodeMapping: [
    { rowIndex: 0, entityIds: ['uuid-cisa'] },
    { rowIndex: 1, entityIds: ['uuid-acme'] },
  ],
  kind: 'evidence',
  graphData: {
    nodes: [node(10, 'CISA', 'uuid-cisa'), node(20, 'Acme', 'uuid-acme')],
    edges: [edge(10, 20, 'CONTRACTS_WITH')],
  },
};

const noop = () => {};

describe('SubgraphInspector', () => {
  it('shows node and relationship counts in the segmented control', () => {
    renderWrapper(
      <SubgraphInspector
        data={data}
        selectedNodeUuids={['uuid-cisa', 'uuid-acme']}
        selectedEdgeKeys={[]}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    expect(screen.getByText('Nodes (2)')).toBeInTheDocument();
    expect(screen.getByText('Relationships (1)')).toBeInTheDocument();
  });

  it('defaults to the Nodes panel and swaps to Relationships via the segmented control', async () => {
    const user = userEvent.setup();
    renderWrapper(
      <SubgraphInspector
        data={data}
        selectedNodeUuids={['uuid-cisa', 'uuid-acme']}
        selectedEdgeKeys={[]}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    // Nodes panel: fixed columns Kind / Name / Type / Description.
    expect(screen.getByText('Kind')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();

    await user.click(screen.getByText('Relationships (1)'));

    // Relationships panel: Source / Type / Target.
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('CONTRACTS_WITH')).toBeInTheDocument();
    expect(screen.queryByText('Kind')).not.toBeInTheDocument();
  });
});
