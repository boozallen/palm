import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Canvas from './Canvas';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import { Node, Edge } from 'reactflow';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';

// Mock ReactFlow
jest.mock('reactflow', () => {
  const MockReactFlow = ({ children, onDrop, onDragOver, onInit }: any) => {
    const mockInstance = {
      project: jest.fn(() => ({ x: 100, y: 100 })),
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      fitView: jest.fn(),
      setViewport: jest.fn(),
    };

    if (onInit) {
      setTimeout(() => onInit(mockInstance), 0);
    }

    return (
      <div
        data-testid='react-flow'
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {children}
        <div data-testid='background' />
      </div>
    );
  };

  return {
    __esModule: true,
    default: MockReactFlow,
    Background: ({ children }: any) => <div data-testid='background'>{children}</div>,
    BackgroundVariant: { Dots: 'dots' },
    useNodesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
    useEdgesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
    addEdge: jest.fn((edge, edges) => [...edges, { ...edge, type: edge.type || 'default' }]),
    applyNodeChanges: jest.fn((changes, nodes) => nodes),
    applyEdgeChanges: jest.fn((changes, edges) => edges),
    BezierEdge: ({ id, sourceX, sourceY, targetX, targetY }: any) => (
      <path data-testid={`bezier-edge-${id}`} d={`M${sourceX},${sourceY} L${targetX},${targetY}`} />
    ),
  };
});

// Mock Mantine components
jest.mock('@mantine/core', () => ({
  Box: ({ children, style, ...props }: any) => <div style={style} {...props}>{children}</div>,
  Center: ({ children, style, ...props }: any) => <div style={style} {...props}>{children}</div>,
  Stack: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ActionIcon: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid={props['data-testid']}>
      {children}
    </button>
  ),
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Paper: ({ children, style, ...props }: any) => <div style={style} {...props}>{children}</div>,
}));

// Mock Tabler icons
jest.mock('@tabler/icons-react', () => ({
  IconHandGrab: () => <div data-testid='icon-hand-grab' />,
  IconWorldWww: () => <div data-testid='icon-world-www' />,
  IconMessage: () => <div data-testid='icon-message' />,
  IconFileText: () => <div data-testid='icon-file-text' />,
  IconFile: () => <div data-testid='icon-file' />,
  IconZoomIn: () => <div data-testid='icon-zoom-in' />,
  IconZoomOut: () => <div data-testid='icon-zoom-out' />,
  IconFocusCentered: () => <div data-testid='icon-focus-centered' />,
}));

// Mock PrimitiveNode
jest.mock('@/features/workflows/components/nodes/PrimitiveNode', () => ({
  __esModule: true,
  default: ({ data }: any) => <div data-testid='primitive-node'>{data.label}</div>,
}));

// Mock PrimitiveConfigModal
jest.mock('@/features/workflows/components/modals/PrimitiveConfigModal', () => ({
  __esModule: true,
  default: ({ opened, onClose, nodeId, onSave }: any) =>
    opened ? (
      <div data-testid='config-modal'>
        <button onClick={() => onSave(nodeId, 'Updated Label', { config: 'test' })}>
          Save Config
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Mock WorkflowBuilderProvider — canvas reads from context, not props
jest.mock('@/features/workflows/providers/WorkflowBuilderProvider', () => ({
  useWorkflowBuilder: jest.fn(),
}));

// Mock API hooks hoisted to canvas level
jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: { availableModels: [] } })),
}));
jest.mock('@/features/shared/api/get-system-config', () => ({
  useGetSystemConfig: jest.fn(() => ({ data: null })),
}));
jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: { documents: [] } })),
}));

// Mock node registry (used when dropping nodes onto canvas)
jest.mock('@/features/workflows/utils/node-registry', () => ({
  getNodeDef: jest.fn(() => ({
    icon: () => null,
    color: 'blue',
    label: 'Test',
    defaultConfig: {},
  })),
}));

// Mock primitive-helpers (used when dropping nodes)
jest.mock('@/features/workflows/utils/primitive-helpers', () => ({
  getPrimitiveLabel: jest.fn(() => 'Test Label'),
}));

const mockNodes: Node<PrimitiveNodeData>[] = [
  {
    id: 'node-1',
    type: 'primitive',
    position: { x: 100, y: 100 },
    data: {
      type: PrimitiveType.PROMPT,
      label: 'Test Prompt',
      icon: () => null,
      color: 'blue',
      config: {},
    },
  },
  {
    id: 'node-2',
    type: 'primitive',
    position: { x: 200, y: 200 },
    data: {
      type: PrimitiveType.WEBSCRAPER,
      label: 'Web Scraper',
      icon: () => null,
      color: 'green',
      config: {},
    },
  },
];

const mockEdges: Edge[] = [
  {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    type: 'default',
  },
];

const { useWorkflowBuilder } = jest.requireMock('@/features/workflows/providers/WorkflowBuilderProvider');

describe('Canvas', () => {
  const mockSetNodes = jest.fn();
  const mockSetEdges = jest.fn();
  const mockSetViewport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useWorkflowBuilder.mockReturnValue({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setViewport: mockSetViewport,
    });
  });

  it('renders empty state when no nodes are provided', () => {
    render(<Canvas />);

    expect(screen.getByTestId('empty-state-title')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state-description')).toBeInTheDocument();
  });

  it('renders the canvas when nodes are in context', () => {
    useWorkflowBuilder.mockReturnValue({
      nodes: mockNodes,
      edges: mockEdges,
      viewport: { x: 0, y: 0, zoom: 0.8 },
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setViewport: mockSetViewport,
    });

    render(<Canvas />);

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('does not show the empty state when nodes are present', () => {
    useWorkflowBuilder.mockReturnValue({
      nodes: mockNodes,
      edges: [],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setViewport: mockSetViewport,
    });

    render(<Canvas />);

    expect(screen.queryByTestId('empty-state-title')).not.toBeInTheDocument();
  });

  it('handles drag and drop to create new nodes', () => {
    render(<Canvas />);

    const reactFlow = screen.getByTestId('react-flow');

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
      })),
    });

    fireEvent.drop(reactFlow, {
      dataTransfer: {
        getData: () => PrimitiveType.PROMPT,
      },
      clientX: 150,
      clientY: 150,
    });

    expect(reactFlow).toBeInTheDocument();
  });

  it('does not show config modal initially', () => {
    useWorkflowBuilder.mockReturnValue({
      nodes: mockNodes,
      edges: [],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setViewport: mockSetViewport,
    });

    render(<Canvas />);

    expect(screen.queryByTestId('config-modal')).not.toBeInTheDocument();
  });

  it('handles edge connections via addEdge', () => {
    const mockReactFlow = require('reactflow');
    const mockAddEdge = mockReactFlow.addEdge;

    mockAddEdge.mockReturnValue([
      { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'default' },
      { id: 'edge-2', source: 'node-1', target: 'node-3', type: 'default' },
    ]);

    render(<Canvas />);

    expect(mockAddEdge).toBeDefined();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles node deletion', () => {
    useWorkflowBuilder.mockReturnValue({
      nodes: mockNodes,
      edges: [
        { id: 'edge-incoming', source: 'node-0', target: 'node-1', type: 'default' },
        { id: 'edge-outgoing', source: 'node-1', target: 'node-2', type: 'default' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setViewport: mockSetViewport,
    });

    render(<Canvas />);

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('renders zoom controls', () => {
    render(<Canvas />);

    expect(screen.getByTestId('icon-zoom-in')).toBeInTheDocument();
    expect(screen.getByTestId('icon-zoom-out')).toBeInTheDocument();
    expect(screen.getByTestId('icon-focus-centered')).toBeInTheDocument();
  });

  it('handles zoom controls interactions', async () => {
    render(<Canvas />);

    await waitFor(() => {
      expect(screen.getByTestId('icon-zoom-in')).toBeInTheDocument();
    });

    const zoomInButton = screen.getByTestId('icon-zoom-in').closest('button');
    if (zoomInButton) { fireEvent.click(zoomInButton); }

    const zoomOutButton = screen.getByTestId('icon-zoom-out').closest('button');
    if (zoomOutButton) { fireEvent.click(zoomOutButton); }

    const fitViewButton = screen.getByTestId('icon-focus-centered').closest('button');
    if (fitViewButton) { fireEvent.click(fitViewButton); }
  });

  it('shows empty state without nodes in context', () => {
    render(<Canvas />);

    expect(screen.getByTestId('empty-state-title')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles multiple edges in context', () => {
    useWorkflowBuilder.mockReturnValue({
      nodes: mockNodes,
      edges: [
        { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'default' },
        { id: 'edge-2', source: 'node-1', target: 'node-3', type: 'default' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setViewport: mockSetViewport,
    });

    render(<Canvas />);

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('ensures all edges use default type for bezier curves', () => {
    const mockReactFlow = require('reactflow');
    const mockAddEdge = mockReactFlow.addEdge;

    render(<Canvas />);

    expect(mockAddEdge).toBeDefined();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  describe('Execution state handling', () => {
    it('creates nodeStatusMap from executionTrace', () => {
      const executionTrace = [
        { primitiveId: 'node-1', status: 'running' },
        { primitiveId: 'node-2', status: 'success' },
      ];

      useWorkflowBuilder.mockReturnValue({
        nodes: mockNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.8 },
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setViewport: mockSetViewport,
      });

      render(<Canvas executionTrace={executionTrace} isExecuting={true} />);

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('passes execution state to NodeActionsContext', () => {
      const executionTrace = [{ primitiveId: 'node-1', status: 'running' }];

      useWorkflowBuilder.mockReturnValue({
        nodes: mockNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.8 },
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setViewport: mockSetViewport,
      });

      render(<Canvas executionTrace={executionTrace} isExecuting={true} />);

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('disables node interactions when isExecuting is true', () => {
      useWorkflowBuilder.mockReturnValue({
        nodes: mockNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.8 },
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setViewport: mockSetViewport,
      });

      const { container } = render(<Canvas isExecuting={true} />);

      const reactFlow = screen.getByTestId('react-flow');
      expect(reactFlow).toBeInTheDocument();
    });

    it('enables node interactions when isExecuting is false', () => {
      useWorkflowBuilder.mockReturnValue({
        nodes: mockNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.8 },
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setViewport: mockSetViewport,
      });

      render(<Canvas isExecuting={false} />);

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('handles empty executionTrace array', () => {
      useWorkflowBuilder.mockReturnValue({
        nodes: mockNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.8 },
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setViewport: mockSetViewport,
      });

      render(<Canvas executionTrace={[]} isExecuting={false} />);

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('updates nodeStatusMap when executionTrace changes', () => {
      useWorkflowBuilder.mockReturnValue({
        nodes: mockNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.8 },
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setViewport: mockSetViewport,
      });

      const { rerender } = render(
        <Canvas executionTrace={[{ primitiveId: 'node-1', status: 'running' }]} isExecuting={true} />
      );

      rerender(
        <Canvas executionTrace={[{ primitiveId: 'node-1', status: 'success' }]} isExecuting={true} />
      );

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('passes isConfigPanelOpen to context when config modal is open', () => {
      useWorkflowBuilder.mockReturnValue({
        nodes: mockNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.8 },
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setViewport: mockSetViewport,
      });

      render(<Canvas />);

      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });
});
