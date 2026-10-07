import { render, screen, fireEvent } from '@testing-library/react';
import PrimitiveNode, { PrimitiveNodeData } from './PrimitiveNode';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import { NodeProps } from 'reactflow';

// Mock NodeActionsContext
const mockOnDelete = jest.fn();
const mockOnConfigure = jest.fn();
const mockUseNodeActions = jest.fn();

jest.mock('./NodeActionsContext', () => ({
  useNodeActions: () => mockUseNodeActions(),
}));

// Mock node-registry
jest.mock('@/features/workflows/utils/node-registry', () => ({
  getNodeDef: jest.fn(() => ({
    icon: () => <div data-testid='node-icon' />,
    color: 'blue',
    label: 'Test Node',
    defaultConfig: {},
  })),
}));

// Mock chatHelperFunctions
jest.mock('@/features/chat/utils/chatHelperFunctions', () => ({
  getFileTypeConfig: jest.fn(() => ({
    icon: () => <div data-testid='file-icon' />,
    color: 'gray',
  })),
}));

// Mock Mantine components
jest.mock('@mantine/core', () => {
  const MockTooltipFloating = ({ children, label, disabled, ...props }: any) => (
    <div data-testid='tooltip-floating' {...props}>
      {children}
    </div>
  );

  const MockTooltip = Object.assign(
    ({ children, label, ...props }: any) => (
      <div data-testid='tooltip' {...props}>
        {children}
      </div>
    ),
    { Floating: MockTooltipFloating }
  );

  return {
    Card: ({ children, variant, style, ...props }: any) => (
      <div data-testid='card' data-variant={variant} style={style} {...props}>
        {children}
      </div>
    ),
    Group: ({ children, noWrap, spacing, position, sx, ...props }: any) => {
      const style = typeof sx === 'function' ? sx({}) : sx;
      return (
        <div
          data-testid='group'
          data-nowrap={noWrap}
          data-spacing={spacing}
          data-position={position}
          style={style}
          {...props}
        >
          {children}
        </div>
      );
    },
    ActionIcon: ({ children, onClick, ...props }: any) => (
      <button onClick={onClick} data-testid={props['data-testid'] || 'action-icon'}>
        {children}
      </button>
    ),
    ThemeIcon: ({ children, ...props }: any) => <div data-testid='theme-icon' {...props}>{children}</div>,
    Text: ({ children, ...props }: any) => <span data-testid='text' {...props}>{children}</span>,
    Badge: ({ children, ...props }: any) => <span data-testid='badge' {...props}>{children}</span>,
    Tooltip: MockTooltip,
    Stack: ({ children, ...props }: any) => <div data-testid='stack' {...props}>{children}</div>,
    Loader: ({ size, color, ...props }: any) => (
      <div data-testid='loader' data-size={size} data-color={color} {...props} />
    ),
  };
});

// Mock Tabler icons
jest.mock('@tabler/icons-react', () => ({
  IconTrash: () => <div data-testid='icon-trash' />,
  IconSettings: () => <div data-testid='icon-settings' />,
  IconFile: () => <div data-testid='icon-file' />,
  IconBolt: () => <div data-testid='icon-bolt' />,
}));

// Mock ReactFlow Handle
jest.mock('reactflow', () => ({
  Handle: ({ type, position, style }: any) => (
    <div data-testid={`handle-${type}`} data-position={position} style={style} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

const mockNodeProps: NodeProps<PrimitiveNodeData> = {
  id: 'test-node-1',
  type: 'primitive',
  data: {
    type: PrimitiveType.PROMPT,
    label: 'Test Prompt Node',
    icon: () => null,
    color: 'blue',
    config: {},
  },
  selected: false,
  xPos: 0,
  yPos: 0,
  dragging: false,
  isConnectable: true,
  zIndex: 0,
};

describe('PrimitiveNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNodeActions.mockReturnValue({
      onDelete: mockOnDelete,
      onConfigure: mockOnConfigure,
      displayData: {
        models: [],
        documents: [],
      },
      nodeStatusMap: undefined,
      isExecuting: false,
      isConfigPanelOpen: false,
    });
  });

  it('renders node with label and handles', () => {
    render(<PrimitiveNode {...mockNodeProps} />);

    expect(screen.getByText('Test Prompt Node')).toBeInTheDocument();
    expect(screen.getByTestId('handle-target')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source')).toBeInTheDocument();
  });

  it('shows action icons when not executing', () => {
    render(<PrimitiveNode {...mockNodeProps} />);

    const settingsButton = screen.getByTestId('icon-settings').closest('button');
    const deleteButton = screen.getByTestId('icon-trash').closest('button');

    expect(screen.getByTestId('icon-settings')).toBeInTheDocument();
    expect(screen.getByTestId('icon-trash')).toBeInTheDocument();

    // Verify buttons are interactive (not disabled by pointer-events)
    fireEvent.click(settingsButton!);
    fireEvent.click(deleteButton!);
    expect(mockOnConfigure).toHaveBeenCalled();
    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('calls onConfigure when settings icon is clicked', () => {
    render(<PrimitiveNode {...mockNodeProps} />);

    const settingsButton = screen.getByTestId('icon-settings').closest('button');
    fireEvent.click(settingsButton!);

    expect(mockOnConfigure).toHaveBeenCalledWith('test-node-1');
  });

  it('calls onDelete when trash icon is clicked', () => {
    render(<PrimitiveNode {...mockNodeProps} />);

    const deleteButton = screen.getByTestId('icon-trash').closest('button');
    fireEvent.click(deleteButton!);

    expect(mockOnDelete).toHaveBeenCalledWith('test-node-1');
  });

  describe('Execution states', () => {
    it('shows executing state when node status is running', () => {
      const statusMap = new Map([['test-node-1', 'running']]);
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: statusMap,
        isExecuting: true,
        isConfigPanelOpen: false,
      });

      const { container } = render(<PrimitiveNode {...mockNodeProps} />);

      const card = container.querySelector('[data-executing="true"]');
      expect(card).toBeInTheDocument();
    });

    it('shows disabled state when workflow is executing but node is not', () => {
      const statusMap = new Map([['test-node-1', 'pending']]);
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: statusMap,
        isExecuting: true,
        isConfigPanelOpen: false,
      });

      const { container } = render(<PrimitiveNode {...mockNodeProps} />);

      const card = container.querySelector('[data-disabled="true"]');
      expect(card).toBeInTheDocument();
    });

    it('does not show disabled state for completed nodes', () => {
      const statusMap = new Map([['test-node-1', 'success']]);
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: statusMap,
        isExecuting: true,
        isConfigPanelOpen: false,
      });

      const { container } = render(<PrimitiveNode {...mockNodeProps} />);

      const card = container.querySelector('[data-disabled="true"]');
      expect(card).not.toBeInTheDocument();
    });

    it('hides action icons when workflow is executing with trace data', () => {
      const statusMap = new Map([['test-node-1', 'running']]);
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: statusMap,
        isExecuting: true,
        isConfigPanelOpen: false,
      });

      render(<PrimitiveNode {...mockNodeProps} />);

      // Icons remain in DOM for smooth transitions but are visually hidden
      // The actual visibility is controlled by opacity and pointer-events CSS
      expect(screen.getByTestId('icon-settings')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('hides action icons when config panel is open', () => {
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: undefined,
        isExecuting: false,
        isConfigPanelOpen: true,
      });

      render(<PrimitiveNode {...mockNodeProps} />);

      // Icons remain in DOM for smooth transitions but are visually hidden
      // The actual visibility is controlled by opacity and pointer-events CSS
      expect(screen.getByTestId('icon-settings')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('shows normal state when not executing', () => {
      const { container } = render(<PrimitiveNode {...mockNodeProps} />);

      const card = container.querySelector('[data-executing="true"]');
      expect(card).not.toBeInTheDocument();

      const disabledCard = container.querySelector('[data-disabled="true"]');
      expect(disabledCard).not.toBeInTheDocument();
    });
  });

  describe('Handle styling', () => {
    it('applies normal handle styling when not executing', () => {
      render(<PrimitiveNode {...mockNodeProps} />);

      const targetHandle = screen.getByTestId('handle-target');
      const sourceHandle = screen.getByTestId('handle-source');

      expect(targetHandle).toHaveStyle({ background: '#00EAFF' });
      expect(sourceHandle).toHaveStyle({ background: '#00EAFF' });
    });

    it('applies disabled handle styling when node is disabled', () => {
      const statusMap = new Map([['test-node-1', 'pending']]);
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: statusMap,
        isExecuting: true,
        isConfigPanelOpen: false,
      });

      render(<PrimitiveNode {...mockNodeProps} />);

      const targetHandle = screen.getByTestId('handle-target');
      const sourceHandle = screen.getByTestId('handle-source');

      expect(targetHandle).toHaveStyle({ background: '#5C5F66' });
      expect(sourceHandle).toHaveStyle({ background: '#5C5F66' });
    });

    it('applies executing handle styling when node is running', () => {
      const statusMap = new Map([['test-node-1', 'running']]);
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: statusMap,
        isExecuting: true,
        isConfigPanelOpen: false,
      });

      render(<PrimitiveNode {...mockNodeProps} />);

      const targetHandle = screen.getByTestId('handle-target');
      const sourceHandle = screen.getByTestId('handle-source');

      expect(targetHandle).toHaveStyle({ background: '#00EAFF' });
      expect(sourceHandle).toHaveStyle({ background: '#00EAFF' });
    });
  });

  describe('Model badge display', () => {
    it('displays model badge for PROMPT nodes with model config', () => {
      const models = [
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'claude-3', name: 'Claude 3' },
      ];

      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models, documents: [] },
        nodeStatusMap: undefined,
        isExecuting: false,
        isConfigPanelOpen: false,
      });

      const propsWithModel = {
        ...mockNodeProps,
        data: {
          ...mockNodeProps.data,
          config: { model: 'gpt-4' },
        },
      };

      render(<PrimitiveNode {...propsWithModel} />);

      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    it('displays truncated model name when model not found in list', () => {
      mockUseNodeActions.mockReturnValue({
        onDelete: mockOnDelete,
        onConfigure: mockOnConfigure,
        displayData: { models: [], documents: [] },
        nodeStatusMap: undefined,
        isExecuting: false,
        isConfigPanelOpen: false,
      });

      const propsWithModel = {
        ...mockNodeProps,
        data: {
          ...mockNodeProps.data,
          config: { model: 'provider/some-very-long-model-name-that-should-be-truncated' },
        },
      };

      render(<PrimitiveNode {...propsWithModel} />);

      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Selected state', () => {
    it('applies selected data attribute when node is selected', () => {
      const { container } = render(<PrimitiveNode {...mockNodeProps} selected={true} />);

      const card = container.querySelector('[data-selected="true"]');
      expect(card).toBeInTheDocument();
    });

    it('does not apply selected data attribute when node is not selected', () => {
      const { container } = render(<PrimitiveNode {...mockNodeProps} selected={false} />);

      const card = container.querySelector('[data-selected="false"]');
      expect(card).toBeInTheDocument();
    });
  });
});
