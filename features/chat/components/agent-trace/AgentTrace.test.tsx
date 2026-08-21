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
    // The rollup row is wrapped in the only button the collapsed trace renders.
    fireEvent.click(screen.getAllByRole('button')[0]);
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

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });
});
