import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import GraphVisualization from './GraphVisualization';
import { renderWrapper } from '@/test/test-utils';

jest.mock('vis-network', () => ({
  Network: jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    fit: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
  })),
}));

jest.mock('vis-data', () => ({
  DataSet: jest.fn().mockImplementation((data) => data),
}));

jest.mock('@mantine/notifications');
jest.mock('@mantine/modals', () => ({
  modals: {
    openConfirmModal: jest.fn(),
  },
}));
jest.mock('@/features/settings/api/graph-database/get-overview', () => jest.fn());
jest.mock('@/features/settings/api/graph-database/query', () => jest.fn());
jest.mock('@/features/chat/api/graph-database', () => ({
  useChatNetwork: jest.fn(),
  useNodeNeighbors: jest.fn(),
  useNodeNeighborCount: jest.fn(),
  useFindShortestPath: jest.fn(),
  useEdgesBetween: jest.fn(),
}));
jest.mock('@/features/settings/api/graph-database/get-user-knowledge-graph', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockOverviewHook = require('@/features/settings/api/graph-database/get-overview');
const mockQueryHook = require('@/features/settings/api/graph-database/query');
const mockChatNetworkHook = require('@/features/chat/api/graph-database');
const mockUserKnowledgeGraphHook = require('@/features/settings/api/graph-database/get-user-knowledge-graph');

describe('GraphVisualization', () => {
  let mockNetwork: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the Network mock for each test
    mockNetwork = {
      setData: jest.fn(),
      fit: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      redraw: jest.fn(),
      getNodeAt: jest.fn().mockReturnValue(undefined),
      getEdgeAt: jest.fn().mockReturnValue(undefined),
      getScale: jest.fn().mockReturnValue(1),
      getViewPosition: jest.fn().mockReturnValue({ x: 0, y: 0 }),
      setOptions: jest.fn(),
      moveTo: jest.fn(),
      setSelection: jest.fn(),
      unselectAll: jest.fn(),
      body: {
        data: {
          nodes: { getIds: jest.fn().mockReturnValue([]) },
        },
      },
    };

    const { Network } = require('vis-network');
    Network.mockImplementation(() => mockNetwork);

    mockOverviewHook.mockReturnValue({
      data: {
        overview: {
          nodeTypes: [
            { labels: ['Person'], count: 10 },
            { labels: ['Document'], count: 5 },
          ],
          relationshipTypes: [
            { type: 'KNOWS', count: 15 },
            { type: 'REFERENCES', count: 8 },
          ],
        },
      },
    });

    mockQueryHook.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      data: null,
      isPending: false,
    });

    mockChatNetworkHook.useChatNetwork.mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
      error: null,
    });

    mockChatNetworkHook.useNodeNeighbors.mockReturnValue({
      fetch: jest.fn(),
    });

    mockChatNetworkHook.useEdgesBetween.mockReturnValue({
      fetch: jest.fn().mockResolvedValue({ edges: [], metadata: { edgeCount: 0 } }),
    });

    mockChatNetworkHook.useNodeNeighborCount.mockReturnValue({
      fetch: jest.fn().mockResolvedValue({ results: [{ totalNeighbors: 0 }] }),
    });

    mockChatNetworkHook.useFindShortestPath.mockReturnValue({
      fetch: jest.fn(),
    });

    mockUserKnowledgeGraphHook.default.mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
      error: null,
    });

    (notifications.show as jest.Mock) = jest.fn();
  });

  it('renders without crashing', () => {
    const { container } = renderWrapper(<GraphVisualization />);
    expect(container).toBeTruthy();
  });

  it('renders main title', () => {
    renderWrapper(<GraphVisualization />);
    expect(screen.getByText('Graph Database')).toBeInTheDocument();
  });

  it('renders filters and options section', () => {
    renderWrapper(<GraphVisualization />);
    expect(screen.getByText('Filters & Options')).toBeInTheDocument();
  });

  it('renders network visualization title', () => {
    renderWrapper(<GraphVisualization />);
    
    const queryButton = screen.getByText('Query');
    fireEvent.click(queryButton);
    
    expect(screen.getByTestId('network-visualization-title')).toBeInTheDocument();
  });

  it('renders query button', () => {
    renderWrapper(<GraphVisualization />);
    expect(screen.getByText('Query')).toBeInTheDocument();
  });

  it('toggles custom query section', () => {
    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    expect(showButton).toBeInTheDocument();

    fireEvent.click(showButton);

    expect(screen.getByText('Hide Custom Query')).toBeInTheDocument();
  });

  it('shows error notification for empty custom query', async () => {
    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        message: 'Please enter a Cypher query',
        color: 'red',
        autoClose: 2000,
        withCloseButton: false,
      });
    });
  });

  it('displays empty graph message when no nodes exist', () => {
    mockOverviewHook.mockReturnValue({
      data: {
        overview: {
          nodeTypes: [],
          relationshipTypes: [],
        },
      },
    });

    renderWrapper(<GraphVisualization />);
    expect(screen.getByText('The graph database is currently empty.')).toBeInTheDocument();
    expect(screen.queryByText('Filters & Options')).not.toBeInTheDocument();
  });

  it('displays node and edge counts', async () => {
    // Mock network data - simulate successful query mutation
    const mockMutateAsync = jest.fn().mockResolvedValue({
      network: {
        nodes: [
          { id: 1, label: 'Node 1', labels: ['Person'], properties: {}, group: 'Person' },
          { id: 2, label: 'Node 2', labels: ['Document'], properties: {}, group: 'Document' },
        ],
        edges: [
          { from: 1, to: 2, label: 'KNOWS', type: 'KNOWS', properties: {} },
        ],
      },
    });
    
    const mockMutate = jest.fn().mockImplementation(() => {
      // Simulate successful mutation by updating the mock data
      mockQueryHook.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        data: {
          network: {
            nodes: [
              { id: 1, label: 'Node 1', labels: ['Person'], properties: {}, group: 'Person' },
              { id: 2, label: 'Node 2', labels: ['Document'], properties: {}, group: 'Document' },
            ],
            edges: [
              { from: 1, to: 2, label: 'KNOWS', type: 'KNOWS', properties: {} },
            ],
          },
        },
        isPending: false,
      });
    });
    
    mockQueryHook.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      data: null,
      isPending: false,
    });

    renderWrapper(<GraphVisualization />);
    
    const queryButton = screen.getByText('Query');
    fireEvent.click(queryButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Nodes: 2/)).toBeInTheDocument();
      expect(screen.getByText(/Edges: 1/)).toBeInTheDocument();
    });
  });

  it('displays selected node details (settings graph: left-click selects)', async () => {
    const testData = {
      network: {
        nodes: [
          {
            id: 1,
            label: 'Node 1',
            labels: ['Person'],
            properties: { name: 'John', filename: '/path/to/document.pdf' },
            group: 'Person',
          },
          {
            id: 2,
            label: 'Node 2',
            labels: ['Document'],
            properties: { title: 'Test Document', source: 'test-source' },
            group: 'Document',
          },
        ],
        edges: [
          {
            from: 1,
            to: 2,
            label: 'KNOWS',
            type: 'KNOWS',
            properties: { since: '2020' },
          },
        ],
      },
    };

    // Mock the query mutation 
    const mockMutateAsync = jest.fn().mockResolvedValue(testData);
    const mockMutate = jest.fn().mockImplementation(() => {
      mockQueryHook.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        data: testData,
        isPending: false,
      });
    });
    
    mockQueryHook.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      data: null,
      isPending: false,
    });

    const { rerender } = renderWrapper(<GraphVisualization />);
    
    const queryButton = screen.getByText('Query');
    fireEvent.click(queryButton);

    rerender(<GraphVisualization />);

    // Wait for the network visualization title to appear (indicates network is loaded)
    await waitFor(() => {
      expect(screen.getByTestId('network-visualization-title')).toBeInTheDocument();
    });

    // Wait for the network instance and event handler to be set up
    await waitFor(() => {
      expect(mockNetwork.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    const clickHandler = mockNetwork.on.mock.calls.find((call: any) => call[0] === 'click')[1];

    // Settings graph: left-click selects the node, surfacing its operations panel.
    act(() => {
      clickHandler({ nodes: [1], edges: [] });
    });

    await waitFor(() => {
      expect(screen.getByText('Selected Node')).toBeInTheDocument();
    });
  });

  it('executes custom query and displays results', async () => {
    const mockQueryResult = {
      recordCount: 5,
      results: [{ id: 1, name: 'Test' }],
      summary: { queryType: 'READ_ONLY' },
    };

    mockQueryHook.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn().mockResolvedValue(mockQueryResult),
      data: null,
      isPending: false,
    });

    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    const textarea = screen.getByPlaceholderText('MATCH (n) RETURN n LIMIT 25');
    fireEvent.change(textarea, { target: { value: 'MATCH (n) RETURN n' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText('Query Results')).toBeInTheDocument();
      expect(screen.getByText(/Records: 5/)).toBeInTheDocument();
      expect(screen.getByText(/Query Type: READ_ONLY/)).toBeInTheDocument();
    });

    expect(notifications.show).toHaveBeenCalledWith({
      message: 'Returned 5 records',
      color: 'teal',
      autoClose: 2000,
      withCloseButton: false,
    });
  });

  it('shows error notification when custom query fails', async () => {
    const errorMessage = 'Syntax error in query';

    mockQueryHook.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn().mockRejectedValue(new Error(errorMessage)),
      data: null,
      isPending: false,
    });

    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    const textarea = screen.getByPlaceholderText('MATCH (n) RETURN n LIMIT 25');
    fireEvent.change(textarea, { target: { value: 'INVALID QUERY' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        message: errorMessage,
        color: 'red',
        autoClose: 3000,
        withCloseButton: false,
      });
    });
  });

  it('renders allow write queries checkbox in custom query section', () => {
    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    expect(screen.getByLabelText('Allow write queries (e.g. CREATE, DELETE, SET)')).toBeInTheDocument();
  });

  it('shows write operations enabled description when allow write is checked', () => {
    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    expect(screen.getByText('Execute custom Cypher queries against your graph database. Only read operations are allowed for security.')).toBeInTheDocument();

    const checkbox = screen.getByLabelText('Allow write queries (e.g. CREATE, DELETE, SET)');
    fireEvent.click(checkbox);

    expect(screen.getByText('Execute custom Cypher queries against your graph database. Write operations are enabled.')).toBeInTheDocument();
  });

  it('opens confirmation modal when executing a query with allow write enabled', async () => {
    mockQueryHook.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn().mockResolvedValue({ recordCount: 1, results: [], summary: {} }),
      data: null,
      isPending: false,
    });

    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    const checkbox = screen.getByLabelText('Allow write queries (e.g. CREATE, DELETE, SET)');
    fireEvent.click(checkbox);

    const textarea = screen.getByPlaceholderText('MATCH (n) RETURN n LIMIT 25');
    fireEvent.change(textarea, { target: { value: 'CREATE (n:Test)' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(modals.openConfirmModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm write query execution',
        }),
      );
    });
  });

  it('does not open confirmation modal when allow write is disabled', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue({
      recordCount: 1,
      results: [],
      summary: { queryType: 'READ_ONLY' },
    });

    mockQueryHook.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: mockMutateAsync,
      data: null,
      isPending: false,
    });

    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    const textarea = screen.getByPlaceholderText('MATCH (n) RETURN n LIMIT 25');
    fireEvent.change(textarea, { target: { value: 'MATCH (n) RETURN n' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ query: 'MATCH (n) RETURN n', allowWrite: false });
    });

    expect(modals.openConfirmModal).not.toHaveBeenCalled();
  });

  it('passes allowWrite true to mutateAsync when confirmed', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue({
      recordCount: 1,
      results: [],
      summary: { queryType: 'WRITE' },
    });

    mockQueryHook.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: mockMutateAsync,
      data: null,
      isPending: false,
    });

    (modals.openConfirmModal as jest.Mock).mockImplementation(({ onConfirm }) => {
      onConfirm();
    });

    renderWrapper(<GraphVisualization />);

    const showButton = screen.getByText('Show Custom Query');
    fireEvent.click(showButton);

    const checkbox = screen.getByLabelText('Allow write queries (e.g. CREATE, DELETE, SET)');
    fireEvent.click(checkbox);

    const textarea = screen.getByPlaceholderText('MATCH (n) RETURN n LIMIT 25');
    fireEvent.change(textarea, { target: { value: 'CREATE (n:Test)' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ query: 'CREATE (n:Test)', allowWrite: true });
    });
  });

  // Renders the chat-context graph (where the hover-swap detail pane lives) with the given
  // network data and returns the captured vis-network event handlers so tests can drive
  // hover/click directly (the network itself is fully mocked).
  const renderChatGraphWithHandlers = async (network: { nodes: any[]; edges: any[] }) => {
    mockChatNetworkHook.useChatNetwork.mockReturnValue({
      data: { network },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWrapper(<GraphVisualization isInChatContext documentIds={['d1']} />);

    await waitFor(() => {
      expect(mockNetwork.on).toHaveBeenCalledWith('hoverNode', expect.any(Function));
    });

    const getHandler = (evt: string) =>
      mockNetwork.on.mock.calls.find((call: any) => call[0] === evt)?.[1];

    return {
      click: getHandler('click'),
      hoverNode: getHandler('hoverNode'),
      blurNode: getHandler('blurNode'),
    };
  };

  it('hover shows the hovered node detail and reverts on blur without changing selection', async () => {
    const handlers = await renderChatGraphWithHandlers({
      nodes: [
        { id: 1, label: 'Alpha', labels: ['Entity'], properties: { name: 'Alpha' } },
        { id: 2, label: 'Beta', labels: ['Concept'], properties: { name: 'Beta' } },
      ],
      edges: [],
    });

    // Nothing hovered or selected → no detail pane.
    expect(screen.queryByText('Node Details')).not.toBeInTheDocument();

    act(() => { handlers.hoverNode({ node: 1 }); });
    await waitFor(() => {
      expect(screen.getByText('Node Details')).toBeInTheDocument();
    });
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    // Blur clears the transient hover; with nothing selected the pane disappears — proving
    // hover never added node 1 to the selection set.
    act(() => { handlers.blurNode(); });
    await waitFor(() => {
      expect(screen.queryByText('Node Details')).not.toBeInTheDocument();
    });
  });

  it('left-click pins a node and moves the single pin between nodes', async () => {
    const handlers = await renderChatGraphWithHandlers({
      nodes: [
        { id: 1, label: 'Alpha', labels: ['Entity'], properties: { name: 'Alpha' } },
        { id: 2, label: 'Beta', labels: ['Concept'], properties: { name: 'Beta' } },
        { id: 3, label: 'Gamma', labels: ['Entity'], properties: { name: 'Gamma' } },
      ],
      edges: [],
    });

    // Left-click node 3 → pins it (card + Unpin affordance), without selecting anything.
    act(() => { handlers.click({ nodes: [3], edges: [] }); });
    await waitFor(() => { expect(screen.getByText('Gamma')).toBeInTheDocument(); });
    expect(screen.getByLabelText('Unpin details')).toBeInTheDocument();

    // Left-click a DIFFERENT node → the single pin MOVES to it (one pin at a time).
    act(() => { handlers.click({ nodes: [1], edges: [] }); });
    await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();

    // Left-click the pinned one again → unpins; nothing selected/hovered → the pane disappears.
    act(() => { handlers.click({ nodes: [1], edges: [] }); });
    await waitFor(() => { expect(screen.queryByText('Node Details')).not.toBeInTheDocument(); });
  });

  it('left-click pins an EDGE (shows Edge Details)', async () => {
    const handlers = await renderChatGraphWithHandlers({
      nodes: [
        { id: 1, label: 'Alpha', labels: ['Entity'], properties: { name: 'Alpha' } },
        { id: 2, label: 'Beta', labels: ['Concept'], properties: { name: 'Beta' } },
      ],
      edges: [{ from: 1, to: 2, label: 'RELATES_TO', type: 'RELATES_TO', properties: {} }],
    });

    // Left-click an edge → pins it. getEdgeKey({from:1,to:2,type:'RELATES_TO'}) === '1-2-RELATES_TO'.
    act(() => { handlers.click({ nodes: [], edges: ['1-2-RELATES_TO'] }); });
    await waitFor(() => { expect(screen.getByText('Edge Details')).toBeInTheDocument(); });
    expect(screen.getByLabelText('Unpin details')).toBeInTheDocument();
  });

  it('the card Selected toggle adds/removes the pinned element from the selection', async () => {
    const handlers = await renderChatGraphWithHandlers({
      nodes: [
        { id: 1, label: 'Alpha', labels: ['Entity'], properties: { name: 'Alpha' } },
        { id: 2, label: 'Beta', labels: ['Concept'], properties: { name: 'Beta' } },
      ],
      edges: [],
    });

    // getByRole({ name }) triggers a jsdom getComputedStyle recursion against the full Mantine tree,
    // so resolve the toggle via its label text instead. The label flips Select ⇄ Deselect with state.
    const selectBtn = () => screen.getByText(/^(Select|Deselect)$/).closest('button') as HTMLButtonElement;

    // Click node 1 → pins it → card shows Alpha with the toggle OFF (label "Select").
    act(() => { handlers.click({ nodes: [1], edges: [] }); });
    await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'false');

    // Click Select → node 1 enters the selection; label flips to "Deselect"; card stays pinned on Alpha.
    act(() => { fireEvent.click(selectBtn()); });
    await waitFor(() => {
      expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByText('Deselect')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByLabelText('Unpin details')).toBeInTheDocument();

    // Click Deselect → removed from the selection; label flips back to "Select".
    act(() => { fireEvent.click(selectBtn()); });
    await waitFor(() => {
      expect(selectBtn()).toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByText('Select')).toBeInTheDocument();
  });

  it('pinned node shows full details; hovering another overrides and reverts on blur', async () => {
    const handlers = await renderChatGraphWithHandlers({
      nodes: [
        { id: 1, label: 'Alpha', labels: ['Entity'], properties: { name: 'Alpha' } },
        { id: 2, label: 'Beta', labels: ['Concept'], properties: { name: 'Beta' } },
      ],
      edges: [],
    });

    // Click one node → pins it → its full details show in the pane.
    act(() => { handlers.click({ nodes: [1], edges: [] }); });
    await waitFor(() => {
      expect(screen.getByText('Node Details')).toBeInTheDocument();
    });
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    // Hover a different node → the pane swaps to that node's details.
    act(() => { handlers.hoverNode({ node: 2 }); });
    await waitFor(() => {
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    // Blur reverts the pane to the pinned node.
    act(() => { handlers.blurNode(); });
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
  });

  // "Select all" / "Deselect all" — the enumeration table drives the canvas operation-set
  // (selectedNodes) without touching membership. With a preloaded enumeration graph, on-canvas nodes
  // are the checked (member) ones, so the selection actions target only those members.
  const makeEnumData = () => ({
    query: 'q',
    generatedCypher: '',
    rowCount: 3,
    kind: 'exploration' as const,
    rows: [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }],
    nodeMapping: [
      { rowIndex: 0, entityIds: ['u1'] },
      { rowIndex: 1, entityIds: ['u2'] },
      { rowIndex: 2, entityIds: ['u3'] },
    ],
    graphData: {
      nodes: [
        { id: 1, label: 'Alpha', labels: ['Entity'], properties: { id: 'u1', name: 'Alpha' }, group: 'Entity', isAnchor: false },
        { id: 2, label: 'Beta', labels: ['Entity'], properties: { id: 'u2', name: 'Beta' }, group: 'Entity', isAnchor: false },
        { id: 3, label: 'Gamma', labels: ['Entity'], properties: { id: 'u3', name: 'Gamma' }, group: 'Entity', isAnchor: false },
      ],
      edges: [],
    },
  });

  const renderEnumGraph = async (onEntitySelectionChange: jest.Mock) => {
    // u1, u2 are members (rendered on canvas); u3 is in the data but unchecked → not on canvas.
    renderWrapper(
      <GraphVisualization
        isInChatContext
        documentIds={['d1']}
        enumerationData={makeEnumData()}
        selectedEntityIds={['u1', 'u2']}
        onEntitySelectionChange={onEntitySelectionChange}
      />,
    );
    // Wait until the canvas is wired (graphData built + refs synced) before driving the table.
    await waitFor(() => {
      expect(mockNetwork.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
    // Locate by text, not role+name: accessible-name computation over this large styled DOM trips a
    // getComputedStyle recursion in jsdom. Clicking the label bubbles to the Mantine Button.
    return screen.findByText('Select all');
  };

  it('Select all puts the on-canvas entities into the op-set without touching membership', async () => {
    const onEntitySelectionChange = jest.fn();
    const selectBtn = await renderEnumGraph(onEntitySelectionChange);
    onEntitySelectionChange.mockClear();

    fireEvent.click(selectBtn);

    // Op-set summary reflects the 2 on-canvas members (u1, u2); the off-graph row (u3) isn't a
    // selection target, so the action only operates on what's drawn.
    await waitFor(() => {
      expect(screen.getAllByText(/2 nodes/).length).toBeGreaterThan(0);
    });
    // The membership channel is never touched by the operation-set action.
    expect(onEntitySelectionChange).not.toHaveBeenCalled();
  });

  it('Select all then Deselect all adds and clears the op-set', async () => {
    const selectBtn = await renderEnumGraph(jest.fn());

    // The 2 rendered members give a persistent "2 nodes" graph count; Select all adds exactly one
    // more "2 nodes" (the op-set summary), and Deselect all removes it again.
    const before = screen.queryAllByText(/2 nodes/).length;

    fireEvent.click(selectBtn);
    await waitFor(() => expect(screen.queryAllByText(/2 nodes/).length).toBe(before + 1));

    // Selecting flips the action to "Deselect all" (the two are separate, contextual buttons).
    const deselectBtn = await screen.findByText('Deselect all');
    fireEvent.click(deselectBtn);
    await waitFor(() => expect(screen.queryAllByText(/2 nodes/).length).toBe(before));
  });
});
