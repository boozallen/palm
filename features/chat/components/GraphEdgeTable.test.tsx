import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GraphEdgeTable from './GraphEdgeTable';
import { GraphSearchResultData } from '@/features/chat/types/message';
import { evidenceEdgeKey } from '@/features/settings/components/graph-databases/components/graphEdgeKey';
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

const CISA = node(10, 'CISA', 'uuid-cisa');
const ACME = node(20, 'Acme', 'uuid-acme');
const GLOBEX = node(30, 'Globex', 'uuid-globex');

const CONTRACTS = edge(10, 20, 'CONTRACTS_WITH'); // CISA → Acme
const AGENCY_FIT = edge(10, 30, 'AGENCY_FIT'); // CISA → Globex

const CONTRACTS_KEY = evidenceEdgeKey('uuid-cisa', 'CONTRACTS_WITH', 'uuid-acme');
const AGENCY_FIT_KEY = evidenceEdgeKey('uuid-cisa', 'AGENCY_FIT', 'uuid-globex');

const makeData = (edges: GraphEdge[], nodes: GraphNode[] = [CISA, ACME, GLOBEX]): GraphSearchResultData => ({
  query: 'Answer evidence',
  generatedCypher: '',
  rowCount: nodes.length,
  rows: [],
  nodeMapping: [],
  kind: 'evidence',
  graphData: { nodes, edges },
});

const ALL_NODES = ['uuid-cisa', 'uuid-acme', 'uuid-globex'];
const ALL_EDGES = [CONTRACTS_KEY, AGENCY_FIT_KEY];

const noop = () => {};

describe('GraphEdgeTable', () => {
  it('renders every cited edge as a Source / Type / Target row regardless of node selection', () => {
    renderWrapper(
      <GraphEdgeTable
        data={makeData([CONTRACTS, AGENCY_FIT])}
        selectedNodeUuids={[]}
        selectedEdgeKeys={[]}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('CONTRACTS_WITH')).toBeInTheDocument();
    expect(screen.getByText('AGENCY_FIT')).toBeInTheDocument();
    expect(screen.getByText('2 relationships', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('0 on graph')).toBeInTheDocument();
  });

  it('reflects endpoint integrity: an edge with a deselected endpoint shows unchecked (matches canvas)', () => {
    // Both edge keys are "selected", but Globex (AGENCY_FIT's target) is NOT a selected node, so the
    // AGENCY_FIT edge is off-canvas and must read as unchecked here — the bug this guards against.
    renderWrapper(
      <GraphEdgeTable
        data={makeData([CONTRACTS, AGENCY_FIT])}
        selectedNodeUuids={['uuid-cisa', 'uuid-acme']}
        selectedEdgeKeys={ALL_EDGES}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    expect(screen.getByText('1 on graph')).toBeInTheDocument();
    // No header checkbox now; [0] = CONTRACTS (both endpoints selected), [1] = AGENCY_FIT.
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
  });

  it('dedupes identical edges and skips edges whose endpoint is missing', () => {
    const data = makeData([CONTRACTS, edge(10, 20, 'CONTRACTS_WITH'), edge(10, 99, 'DANGLING')]);
    renderWrapper(
      <GraphEdgeTable
        data={data}
        selectedNodeUuids={ALL_NODES}
        selectedEdgeKeys={ALL_EDGES}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    expect(screen.getByText('1 relationship', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1 on graph')).toBeInTheDocument();
    expect(screen.queryByText('DANGLING')).not.toBeInTheDocument();
  });

  it('narrows to a single relationship type via the per-column Type filter', async () => {
    const user = userEvent.setup();
    renderWrapper(
      <GraphEdgeTable
        data={makeData([CONTRACTS, AGENCY_FIT])}
        selectedNodeUuids={ALL_NODES}
        selectedEdgeKeys={ALL_EDGES}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    // Filter the Type column to AGENCY_FIT (the 2nd filter input — source, type, target).
    const filters = screen.getAllByPlaceholderText('Filter...');
    await user.type(filters[1], 'AGENCY_FIT');

    expect(screen.getByText('AGENCY_FIT')).toBeInTheDocument();
    expect(screen.queryByText('CONTRACTS_WITH')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 relationships', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('2 on graph')).toBeInTheDocument();
  });

  it('Remove all is scoped to the filter — drops only the filtered subset when all-selected', async () => {
    const user = userEvent.setup();
    const onEdgeSelectionChange = jest.fn();
    const onNodeSelectionChange = jest.fn();
    renderWrapper(
      <GraphEdgeTable
        data={makeData([CONTRACTS, AGENCY_FIT])}
        selectedNodeUuids={ALL_NODES}
        selectedEdgeKeys={ALL_EDGES} // default: both selected
        onNodeSelectionChange={onNodeSelectionChange}
        onEdgeSelectionChange={onEdgeSelectionChange}
      />,
    );

    await user.type(screen.getAllByPlaceholderText('Filter...')[1], 'AGENCY_FIT');
    // The filtered AGENCY_FIT edge is already selected → Remove all drops it, leaving the
    // (non-filtered) CONTRACTS_WITH selection untouched.
    await user.click(screen.getByRole('button', { name: /remove all/i }));

    expect(onEdgeSelectionChange).toHaveBeenCalledWith([CONTRACTS_KEY]);
  });

  it('Add all adds the filtered subset + its endpoints when none selected', async () => {
    const user = userEvent.setup();
    const onEdgeSelectionChange = jest.fn();
    const onNodeSelectionChange = jest.fn();
    renderWrapper(
      <GraphEdgeTable
        data={makeData([CONTRACTS, AGENCY_FIT])}
        selectedNodeUuids={[]}
        selectedEdgeKeys={[]}
        onNodeSelectionChange={onNodeSelectionChange}
        onEdgeSelectionChange={onEdgeSelectionChange}
      />,
    );

    await user.type(screen.getAllByPlaceholderText('Filter...')[1], 'AGENCY_FIT');
    await user.click(screen.getByRole('button', { name: /add all/i }));

    expect(onEdgeSelectionChange).toHaveBeenCalledWith([AGENCY_FIT_KEY]);
    expect(onNodeSelectionChange).toHaveBeenCalledWith(['uuid-cisa', 'uuid-globex']);
  });

  it('checking a single edge unions its endpoints into the node selection', async () => {
    const user = userEvent.setup();
    const onEdgeSelectionChange = jest.fn();
    const onNodeSelectionChange = jest.fn();
    renderWrapper(
      <GraphEdgeTable
        data={makeData([AGENCY_FIT])}
        selectedNodeUuids={[]}
        selectedEdgeKeys={[]}
        onNodeSelectionChange={onNodeSelectionChange}
        onEdgeSelectionChange={onEdgeSelectionChange}
      />,
    );

    // No header checkbox now; checkbox[0] = the single AGENCY_FIT row.
    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(onEdgeSelectionChange).toHaveBeenCalledWith([AGENCY_FIT_KEY]);
    expect(onNodeSelectionChange).toHaveBeenCalledWith(['uuid-cisa', 'uuid-globex']);
  });

  it('sorts rows by Source ascending then descending', async () => {
    const user = userEvent.setup();
    // Two edges with different source names: Acme→CISA and CISA→Acme.
    const data = makeData([edge(20, 10, 'X'), edge(10, 20, 'Y')], [CISA, ACME]);
    renderWrapper(
      <GraphEdgeTable
        data={data}
        selectedNodeUuids={['uuid-cisa', 'uuid-acme']}
        selectedEdgeKeys={[]}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    const sourceText = () =>
      screen
        .getAllByRole('row')
        .slice(1) // drop the header row
        .map((tr) => within(tr).getAllByRole('cell')[1].textContent);

    await user.click(screen.getByText('Source'));
    expect(sourceText()).toEqual(['Acme', 'CISA']);

    await user.click(screen.getByText('Source'));
    expect(sourceText()).toEqual(['CISA', 'Acme']);
  });

  it('shows an empty state when there are no relationships', () => {
    renderWrapper(
      <GraphEdgeTable
        data={makeData([])}
        selectedNodeUuids={ALL_NODES}
        selectedEdgeKeys={[]}
        onNodeSelectionChange={noop}
        onEdgeSelectionChange={noop}
      />,
    );

    expect(screen.getByText('No relationships in this subgraph.')).toBeInTheDocument();
  });

  describe('bulk add / remove from graph', () => {
    it('shows Add all (not Remove all) when nothing is on the graph', () => {
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={[]}
          selectedEdgeKeys={[]}
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
        />,
      );
      expect(screen.getByRole('button', { name: /add all/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remove all/i })).not.toBeInTheDocument();
    });

    it('Remove all drops every edge but keeps the nodes on the graph', async () => {
      const user = userEvent.setup();
      const onEdgeSelectionChange = jest.fn();
      const onNodeSelectionChange = jest.fn();
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={ALL_EDGES} // all on graph → Add all hidden, Remove all shown
          onNodeSelectionChange={onNodeSelectionChange}
          onEdgeSelectionChange={onEdgeSelectionChange}
        />,
      );

      expect(screen.queryByRole('button', { name: /add all/i })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /remove all/i }));
      expect(onEdgeSelectionChange).toHaveBeenCalledWith([]);
      expect(onNodeSelectionChange).not.toHaveBeenCalled();
    });

    it('Add all selects the remaining edges and unions in their endpoints', async () => {
      const user = userEvent.setup();
      const onEdgeSelectionChange = jest.fn();
      const onNodeSelectionChange = jest.fn();
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={['uuid-cisa', 'uuid-acme']} // CONTRACTS on graph; AGENCY_FIT off (no Globex)
          selectedEdgeKeys={[CONTRACTS_KEY]}
          onNodeSelectionChange={onNodeSelectionChange}
          onEdgeSelectionChange={onEdgeSelectionChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add all/i }));
      expect(onEdgeSelectionChange).toHaveBeenCalledWith([CONTRACTS_KEY, AGENCY_FIT_KEY]);
      expect(onNodeSelectionChange).toHaveBeenCalledWith(['uuid-cisa', 'uuid-acme', 'uuid-globex']);
    });

    it('Remove all only removes the filtered relationships', async () => {
      const user = userEvent.setup();
      const onEdgeSelectionChange = jest.fn();
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={ALL_EDGES}
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={onEdgeSelectionChange}
        />,
      );

      await user.type(screen.getAllByPlaceholderText('Filter...')[1], 'AGENCY_FIT');
      await user.click(screen.getByRole('button', { name: /remove all/i }));
      expect(onEdgeSelectionChange).toHaveBeenCalledWith([CONTRACTS_KEY]);
    });
  });

  describe('canvas selection (edge op-set channel)', () => {
    it('renders no selection actions when onSelectEdgesOnGraph is absent', () => {
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={ALL_EDGES}
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
        />,
      );
      expect(screen.queryByRole('button', { name: /^select all$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^deselect all$/i })).not.toBeInTheDocument();
    });

    it('Select all selects the on-graph relationships into the op-set', async () => {
      const user = userEvent.setup();
      const onSelectEdgesOnGraph = jest.fn();
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={ALL_EDGES} // both on graph
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
          onSelectEdgesOnGraph={onSelectEdgesOnGraph}
        />,
      );

      await user.click(screen.getByRole('button', { name: /^select all$/i }));
      expect(onSelectEdgesOnGraph).toHaveBeenCalledWith([CONTRACTS_KEY, AGENCY_FIT_KEY]);
    });

    it('Select all scopes to the filtered relationships', async () => {
      const user = userEvent.setup();
      const onSelectEdgesOnGraph = jest.fn();
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={ALL_EDGES}
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
          onSelectEdgesOnGraph={onSelectEdgesOnGraph}
        />,
      );

      await user.type(screen.getAllByPlaceholderText('Filter...')[1], 'AGENCY_FIT');
      await user.click(screen.getByRole('button', { name: /^select all$/i }));
      expect(onSelectEdgesOnGraph).toHaveBeenCalledWith([AGENCY_FIT_KEY]);
    });

    it('offers no Select all when no relationship is on the graph', () => {
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={[]} // none on graph
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
          onSelectEdgesOnGraph={jest.fn()}
        />,
      );
      expect(screen.queryByRole('button', { name: /^select all$/i })).not.toBeInTheDocument();
    });

    it('Clear toggles the op-selected relationships back out', async () => {
      const user = userEvent.setup();
      const onSelectEdgesOnGraph = jest.fn();
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={ALL_EDGES}
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
          onSelectEdgesOnGraph={onSelectEdgesOnGraph}
          opSelectedEdgeKeys={ALL_EDGES} // both op-selected
        />,
      );

      await user.click(screen.getByRole('button', { name: /^deselect all$/i }));
      expect(onSelectEdgesOnGraph).toHaveBeenCalledWith([CONTRACTS_KEY, AGENCY_FIT_KEY]);
    });

    it('row-body click sends the clicked edge key to onSelectEdgesOnGraph', async () => {
      const user = userEvent.setup();
      const onSelectEdgesOnGraph = jest.fn();
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={[CONTRACTS_KEY]} // CONTRACTS is on the graph → its row is op-selectable
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
          onSelectEdgesOnGraph={onSelectEdgesOnGraph}
        />,
      );

      await user.click(screen.getByText('CONTRACTS_WITH')); // click the row body, not the checkbox
      expect(onSelectEdgesOnGraph).toHaveBeenCalledWith([CONTRACTS_KEY]);
    });

    it('marks edge rows whose key is in opSelectedEdgeKeys with the left accent', () => {
      renderWrapper(
        <GraphEdgeTable
          data={makeData([CONTRACTS, AGENCY_FIT])}
          selectedNodeUuids={ALL_NODES}
          selectedEdgeKeys={ALL_EDGES}
          onNodeSelectionChange={noop}
          onEdgeSelectionChange={noop}
          opSelectedEdgeKeys={[CONTRACTS_KEY]}
        />,
      );

      // The accent bar lives on the row's first cell (box-shadow on <tr> renders unreliably).
      const contractsCell = screen.getByText('CONTRACTS_WITH').closest('tr')?.querySelector('td');
      expect(contractsCell?.getAttribute('style') ?? '').toContain('inset');
      const agencyCell = screen.getByText('AGENCY_FIT').closest('tr')?.querySelector('td');
      expect(agencyCell?.getAttribute('style') ?? '').not.toContain('inset');
    });
  });
});
