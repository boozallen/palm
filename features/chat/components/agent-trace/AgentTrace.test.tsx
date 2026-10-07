import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import AgentTrace from './AgentTrace';
import {
  AgentTraceStep,
  AgentTraceStepStatus,
  AgentTraceStepType,
} from '@/features/chat/types/agent-trace';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

const steps: AgentTraceStep[] = [
  {
    id: 'step-1',
    type: AgentTraceStepType.ToolCall,
    status: AgentTraceStepStatus.Done,
    toolName: 'search',
    toolLabel: 'Searching the knowledge base',
  },
];

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
      {component}
    </MantineProvider>
  );
};

describe('AgentTrace', () => {
  const mockCreateAuditRecord = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({
      mutate: mockCreateAuditRecord,
    });
  });

  const toggle = () => {
    fireEvent.click(screen.getByTestId('agent-trace-toggle'));
  };

  it('records expanding the trace as a panel toggle', () => {
    renderWithMantine(<AgentTrace steps={steps} />);

    toggle();

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.TogglePanel,
      label: 'Expand agent trace',
    });
  });

  it('records collapsing the trace with the state being moved to', () => {
    renderWithMantine(<AgentTrace steps={steps} />);

    toggle();
    toggle();

    expect(mockCreateAuditRecord).toHaveBeenCalledTimes(2);
    expect(mockCreateAuditRecord.mock.calls[1][0]).toEqual({
      event: AuditRecordEvent.TogglePanel,
      label: 'Collapse agent trace',
    });
  });

  // A trace toggle changes nothing but what is on screen, so it must not be
  // recorded as a navigation — an href-less NAVIGATION becomes a page in the
  // Context Studio transition matrix.
  it('never records the toggle as a navigation', () => {
    renderWithMantine(<AgentTrace steps={steps} />);

    toggle();

    const [[call]] = mockCreateAuditRecord.mock.calls;
    expect(call.event).not.toBe(AuditRecordEvent.Navigation);
    expect(call).not.toHaveProperty('href');
  });

  it('records nothing when there is no trace to toggle', () => {
    renderWithMantine(<AgentTrace steps={[]} isProcessing />);

    expect(screen.queryByTestId('agent-trace-toggle')).not.toBeInTheDocument();
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('summarizes finished edit and read tool calls in plain language', () => {
    const editReadSteps: AgentTraceStep[] = [
      { id: 'step-1', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'Edit' },
      { id: 'step-2', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'Write' },
      { id: 'step-3', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'Read' },
    ];

    renderWithMantine(<AgentTrace steps={editReadSteps} />);

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent('Edited 2 files, read a file');
  });

  it('falls back to a tool count for unrecognized tool names', () => {
    const unknownToolSteps: AgentTraceStep[] = [
      { id: 'step-1', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'custom_tool' },
      { id: 'step-2', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'another_tool' },
    ];

    renderWithMantine(<AgentTrace steps={unknownToolSteps} />);

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent('Used 2 tools');
  });

  it('labels unrecognized tool calls as "other" alongside a recognized category', () => {
    const mixedSteps: AgentTraceStep[] = [
      { id: 'step-1', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'Bash' },
      { id: 'step-2', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'Bash' },
      { id: 'step-3', type: AgentTraceStepType.ToolCall, status: AgentTraceStepStatus.Done, toolName: 'create_pptx' },
    ];

    renderWithMantine(<AgentTrace steps={mixedSteps} />);

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent('Ran 2 commands, used 1 other tool');
  });

  it('shows "Done" when finished without any tool calls', () => {
    const thinkingOnlySteps: AgentTraceStep[] = [
      { id: 'step-1', type: AgentTraceStepType.Thinking, status: AgentTraceStepStatus.Done, toolLabel: 'Thinking...' },
    ];

    renderWithMantine(<AgentTrace steps={thinkingOnlySteps} />);

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent('Done');
  });
});
