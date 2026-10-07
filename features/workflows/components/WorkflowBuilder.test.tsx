import { render, screen } from '@testing-library/react';
import WorkflowBuilder from './WorkflowBuilder';

// Mock Canvas component
jest.mock('./Canvas', () => ({
  __esModule: true,
  default: ({ executionTrace, isExecuting, workflowId, onSaveNodeConfig }: any) => (
    <div data-testid='canvas'>
      <div data-testid='canvas-workflow-id'>{workflowId}</div>
      <div data-testid='canvas-is-executing'>{String(isExecuting)}</div>
      <div data-testid='canvas-trace-length'>{executionTrace?.length || 0}</div>
    </div>
  ),
}));

// Mock SimpleView component
jest.mock('./SimpleView', () => ({
  __esModule: true,
  default: () => <div data-testid='simple-view'>Simple View</div>,
}));

// Mock PrimitivePalette component
jest.mock('./PrimitivePalette', () => ({
  __esModule: true,
  default: () => <div data-testid='primitive-palette'>Primitive Palette</div>,
}));

// Mock Mantine components
jest.mock('@mantine/core', () => ({
  Box: ({ children, style, ...props }: any) => <div style={style} {...props}>{children}</div>,
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

describe('WorkflowBuilder', () => {
  const mockOnSaveNodeConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Canvas in canvas view mode', () => {
    render(
      <WorkflowBuilder
        workflowId='workflow-123'
        onSaveNodeConfig={mockOnSaveNodeConfig}
        viewMode='canvas'
      />
    );

    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('simple-view')).not.toBeInTheDocument();
  });

  it('renders SimpleView in simple view mode', () => {
    render(
      <WorkflowBuilder
        workflowId='workflow-123'
        onSaveNodeConfig={mockOnSaveNodeConfig}
        viewMode='simple'
      />
    );

    expect(screen.getByTestId('simple-view')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument();
  });

  it('defaults to canvas view mode when viewMode not provided', () => {
    render(
      <WorkflowBuilder
        workflowId='workflow-123'
        onSaveNodeConfig={mockOnSaveNodeConfig}
      />
    );

    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('simple-view')).not.toBeInTheDocument();
  });

  it('passes workflowId to Canvas', () => {
    render(
      <WorkflowBuilder
        workflowId='test-workflow-456'
        onSaveNodeConfig={mockOnSaveNodeConfig}
      />
    );

    expect(screen.getByTestId('canvas-workflow-id')).toHaveTextContent('test-workflow-456');
  });

  it('passes onSaveNodeConfig to Canvas', () => {
    render(
      <WorkflowBuilder
        workflowId='workflow-123'
        onSaveNodeConfig={mockOnSaveNodeConfig}
      />
    );

    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });

  describe('Execution props', () => {
    it('passes executionTrace to Canvas', () => {
      const executionTrace = [
        { primitiveId: 'node-1', status: 'running' },
        { primitiveId: 'node-2', status: 'success' },
      ];

      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
          executionTrace={executionTrace}
        />
      );

      expect(screen.getByTestId('canvas-trace-length')).toHaveTextContent('2');
    });

    it('passes isExecuting to Canvas', () => {
      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
          isExecuting={true}
        />
      );

      expect(screen.getByTestId('canvas-is-executing')).toHaveTextContent('true');
    });

    it('handles empty executionTrace', () => {
      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
          executionTrace={[]}
        />
      );

      expect(screen.getByTestId('canvas-trace-length')).toHaveTextContent('0');
    });

    it('handles undefined executionTrace', () => {
      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
        />
      );

      expect(screen.getByTestId('canvas-trace-length')).toHaveTextContent('0');
    });

    it('handles isExecuting false', () => {
      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
          isExecuting={false}
        />
      );

      expect(screen.getByTestId('canvas-is-executing')).toHaveTextContent('false');
    });
  });

  describe('Panel rendering', () => {
    it('renders executionPanel when provided', () => {
      const executionPanel = <div data-testid='execution-panel'>Execution Panel</div>;

      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
          executionPanel={executionPanel}
        />
      );

      expect(screen.getByTestId('execution-panel')).toBeInTheDocument();
    });

    it('renders generatorPanel when provided', () => {
      const generatorPanel = <div data-testid='generator-panel'>Generator Panel</div>;

      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
          generatorPanel={generatorPanel}
        />
      );

      expect(screen.getByTestId('generator-panel')).toBeInTheDocument();
    });

    it('renders both panels when provided', () => {
      const executionPanel = <div data-testid='execution-panel'>Execution Panel</div>;
      const generatorPanel = <div data-testid='generator-panel'>Generator Panel</div>;

      render(
        <WorkflowBuilder
          workflowId='workflow-123'
          onSaveNodeConfig={mockOnSaveNodeConfig}
          executionPanel={executionPanel}
          generatorPanel={generatorPanel}
        />
      );

      expect(screen.getByTestId('execution-panel')).toBeInTheDocument();
      expect(screen.getByTestId('generator-panel')).toBeInTheDocument();
    });
  });
});
