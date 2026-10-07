import { waitFor, screen } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import GraphVisualization from './GraphVisualization';
import { renderWrapper } from '@/test/test-utils';

// Right-clicking an inline answer citation pins the cited node/edge on the graph canvas IDENTICALLY to
// right-clicking that element on the canvas (same pinnedElement → gray halo + pinned detail card). The
// channel is ChatProvider.graphCitationPin. GraphVisualization is the ONLY consumer of useChat() in
// this subtree, so we mock useChat to drive the pin from a controllable module variable and assert the
// SAME pinned card a canvas right-click produces.

let mockGraphCitationPin: { target: { nodeUuid?: string; edge?: { src: string; relType: string; tgt: string } }; sourceMessageId: string } | null = null;

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  __esModule: true,
  useChat: () => ({
    setHighlightedCitation: jest.fn(),
    setSourcesSidebarExpanded: jest.fn(),
    graphCitationPin: mockGraphCitationPin,
  }),
}));

jest.mock('vis-network', () => ({ Network: jest.fn() }));
jest.mock('vis-data', () => ({ DataSet: jest.fn().mockImplementation((data) => data) }));
jest.mock('@mantine/notifications');
jest.mock('@mantine/modals', () => ({ modals: { openConfirmModal: jest.fn() } }));
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

describe('GraphVisualization — citation right-click pin', () => {
  let mockNetwork: any;

  // Two nodes carrying their UUIDs at properties.id (the space a citation speaks), joined by one edge
  // in the REAL shape: generic Neo4j type 'RELATED' with the semantic type at properties.relationType.
  const network = {
    nodes: [
      { id: 1, label: 'Alpha', labels: ['Entity'], properties: { id: 'uuid-alpha', name: 'Alpha' } },
      { id: 2, label: 'Beta', labels: ['Entity'], properties: { id: 'uuid-beta', name: 'Beta' } },
    ],
    edges: [
      { from: 1, to: 2, label: 'USES', type: 'RELATED', properties: { relationType: 'USES' } },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphCitationPin = null;

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
      body: { data: { nodes: { getIds: () => [1, 2] }, edges: { getIds: () => ['1-2-AGENCY_FIT'] } } },
    };
    require('vis-network').Network.mockImplementation(() => mockNetwork);

    mockOverviewHook.mockReturnValue({ data: { overview: { nodeTypes: [], relationshipTypes: [] } } });
    mockQueryHook.mockReturnValue({ mutate: jest.fn(), mutateAsync: jest.fn(), data: null, isPending: false });
    mockChatNetworkHook.useChatNetwork.mockReturnValue({
      data: { network },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockChatNetworkHook.useNodeNeighbors.mockReturnValue({ fetch: jest.fn() });
    mockChatNetworkHook.useEdgesBetween.mockReturnValue({ fetch: jest.fn().mockResolvedValue({ edges: [], metadata: { edgeCount: 0 } }) });
    mockChatNetworkHook.useNodeNeighborCount.mockReturnValue({ fetch: jest.fn().mockResolvedValue({ results: [{ totalNeighbors: 0 }] }) });
    mockChatNetworkHook.useFindShortestPath.mockReturnValue({ fetch: jest.fn() });
    mockUserKnowledgeGraphHook.default.mockReturnValue({ data: null, isPending: false, isError: false, error: null });
    (notifications.show as jest.Mock) = jest.fn();
  });

  const renderChatGraph = async () => {
    const result = renderWrapper(<GraphVisualization isInChatContext documentIds={['d1']} />);
    await waitFor(() => {
      expect(mockNetwork.on).toHaveBeenCalledWith('hoverNode', expect.any(Function));
    });
    return result;
  };

  const rerenderGraph = (rerender: (ui: React.ReactElement) => void) =>
    rerender(<GraphVisualization isInChatContext documentIds={['d1']} />);

  it('pins the cited node on right-click and unpins on a second right-click (toggle)', async () => {
    const { rerender } = await renderChatGraph();

    // First right-click → pin (the card gains the Unpin affordance + shows the node).
    mockGraphCitationPin = { target: { nodeUuid: 'uuid-alpha' }, sourceMessageId: 'm1' };
    rerenderGraph(rerender);
    await waitFor(() => expect(screen.getByLabelText('Unpin details')).toBeInTheDocument());
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    // Second right-click on the SAME citation (new request object) → unpin → card releases.
    mockGraphCitationPin = { target: { nodeUuid: 'uuid-alpha' }, sourceMessageId: 'm1' };
    rerenderGraph(rerender);
    await waitFor(() => expect(screen.queryByLabelText('Unpin details')).not.toBeInTheDocument());
  });

  it('pins the cited relationship (R# → edge) even when the handle stored the generic "RELATED" type', async () => {
    const { rerender } = await renderChatGraph();

    // The bug case: the handle map's relType is the generic 'RELATED', the rendered edge's semantic
    // type is 'USES'. The right-click must still resolve to that edge.
    mockGraphCitationPin = { target: { edge: { src: 'uuid-alpha', relType: 'RELATED', tgt: 'uuid-beta' } }, sourceMessageId: 'm1' };
    rerenderGraph(rerender);
    await waitFor(() => expect(screen.getByText('Edge Details')).toBeInTheDocument());
    expect(screen.getByLabelText('Unpin details')).toBeInTheDocument();
  });

  it('lands a pending pin once the cited node appears on the canvas (jump / re-add settles)', async () => {
    const { rerender } = await renderChatGraph();

    // Right-click a citation whose node is NOT on the canvas yet (it lives on a different turn, or was
    // removed). The pin is held pending — nothing pinned, and crucially NO dead-end error fired.
    mockGraphCitationPin = { target: { nodeUuid: 'uuid-gamma' }, sourceMessageId: 'm1' };
    rerenderGraph(rerender);
    await waitFor(() => expect(screen.queryByLabelText('Unpin details')).not.toBeInTheDocument());
    expect(notifications.show).not.toHaveBeenCalled();

    // The jump / re-add brings the node onto the canvas — the network now includes it.
    mockChatNetworkHook.useChatNetwork.mockReturnValue({
      data: {
        network: {
          nodes: [
            ...network.nodes,
            { id: 3, label: 'Gamma', labels: ['Entity'], properties: { id: 'uuid-gamma', name: 'Gamma' } },
          ],
          edges: network.edges,
        },
      },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    rerenderGraph(rerender);

    // The pending pin lands on the now-present node, and no error notification is ever shown.
    await waitFor(() => expect(screen.getByLabelText('Unpin details')).toBeInTheDocument());
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('explains why only after the jump / re-add window passes and the element truly never appears', async () => {
    const { rerender } = await renderChatGraph();

    mockGraphCitationPin = { target: { nodeUuid: 'uuid-not-rendered' }, sourceMessageId: 'm1' };
    rerenderGraph(rerender);
    // The notice is deferred (the orchestration is given time to land the node) — it fires via the
    // fallback timer, so allow longer than the timer window.
    await waitFor(
      () =>
        expect(notifications.show).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining('entity') }),
        ),
      { timeout: 2500 },
    );
    expect(screen.queryByLabelText('Unpin details')).not.toBeInTheDocument();
  });
});
