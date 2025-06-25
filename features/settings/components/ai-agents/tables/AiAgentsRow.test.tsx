import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import AiAgentsRow from './AiAgentsRow';
import useUpdateAiAgent from '@/features/settings/api/update-ai-agent';
import useGetCertaRequirements from '@/features/settings/api/ai-agents/certa/get-certa-requirements';
import { AgentType } from '@/features/shared/types';

jest.mock('@/features/settings/api/update-ai-agent');
jest.mock('@/features/settings/api/ai-agents/certa/get-certa-requirements');

jest.mock('@mantine/notifications');

function TableRowWrapper(
  props: Readonly<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  }>
) {
  return (
    <table>
      <tbody>
        <AiAgentsRow {...props} />
      </tbody>
    </table>
  );
}

describe('AiAgentsRow', () => {
  const defaultProps = {
    id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
    name: 'Test AI Agent',
    description: 'This is a test AI agent description',
    enabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateAiAgent as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      error: null,
    });

    (useGetCertaRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [],
      },
      isPending: false,
    });

    (notifications.show as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the agent name correctly', () => {
    render(<TableRowWrapper {...defaultProps} />);
    expect(screen.getByText('Test AI Agent')).toBeInTheDocument();
  });

  it('displays an info icon with tooltip containing description', () => {
    render(<TableRowWrapper {...defaultProps} />);
    const infoIcon = screen.getByTestId('agent-management-info-icon');
    expect(infoIcon).toBeInTheDocument();
  });

  it('renders checkbox with correct checked state when enabled', () => {
    render(<TableRowWrapper {...defaultProps} enabled={true} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('renders checkbox with correct checked state when disabled', () => {
    render(<TableRowWrapper {...defaultProps} enabled={false} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('calls updateAiAgent when checkbox is clicked', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue({});
    (useUpdateAiAgent as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
    });

    render(<TableRowWrapper {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
        enabled: true,
      });
    });
  });

  it('displays error notification when update fails', async () => {
    const error = new Error('Update failed');
    const mockMutateAsync = jest.fn().mockRejectedValue(error);

    (useUpdateAiAgent as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: error,
    });

    render(<TableRowWrapper {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'update-ai-agent-failed',
          title: 'Failed to Update',
          message: 'Update failed',
          variant: 'failed_operation',
          autoClose: false,
        })
      );
    });
  });

  it('has correct aria-label on checkbox', () => {
    render(<TableRowWrapper {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-label', 'Enable Test AI Agent');
  });

  it('prevents enabling by disabling checkbox when requirements are not met', async () => {
    (useGetCertaRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: false,
        requirements: [
          { name: 'Requirement 1', available: false },
          { name: 'Requirement 2', available: false },
        ],
      },
      isPending: false,
    });

    const mockMutateAsync = jest.fn().mockResolvedValue({});
    (useUpdateAiAgent as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
    });

    render(
      <TableRowWrapper
        {...{
          ...defaultProps,
          name: AgentType.CERTA,
        }}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('displays requirements when agent has unmet requirements', async () => {
    (useGetCertaRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: false,
        requirements: [
          { name: 'Requirement 1', available: false },
          { name: 'Requirement 2', available: false },
        ],
      },
      isPending: false,
    });

    render(
      <TableRowWrapper
        {...{
          ...defaultProps,
          name: AgentType.CERTA,
        }}
      />
    );

    expect(screen.getByText('Requirement 1')).toBeInTheDocument();
    expect(screen.getByText('Requirement 2')).toBeInTheDocument();
  });

  it('disables checkbox during status loading', () => {
    (useGetCertaRequirements as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
    });

    render(
      <TableRowWrapper
        {...{
          ...defaultProps,
          name: AgentType.CERTA,
        }}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();

    expect(screen.getByText('Loading requirements...')).toBeInTheDocument();
  });
});
