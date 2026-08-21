import { notifications } from '@mantine/notifications';
import { render, screen, waitFor } from '@testing-library/react';

import DeleteAgentModal from './DeleteAgentModal';
import useDeleteAiAgent from '@/features/settings/api/ai-agents/delete-ai-agent';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/delete-ai-agent');

const mutateAsync = jest.fn();
const mockDeleteAgent = (isPending: boolean = false) => {
  (useDeleteAiAgent as jest.Mock).mockReturnValue({
    mutateAsync,
    isPending,
  });
};

describe('DeleteAgentModal', () => {
  const closeModalHandler = jest.fn();
  const agentId = 'a5866d47-4b20-4dba-b618-0aa634e4f5dc';

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAgent();
  });

  it('renders the modal if modalOpen', () => {
    render(
      <DeleteAgentModal
        modalOpen={true}
        closeModalHandler={closeModalHandler}
        agentId={agentId}
      />
    );

    expect(screen.getByText('Delete AI Agent')).toBeInTheDocument();
  });

  it('does not render the modal if modalOpen is false', () => {
    render(
      <DeleteAgentModal
        modalOpen={false}
        closeModalHandler={closeModalHandler}
        agentId={agentId}
      />
    );

    expect(screen.queryByText('Delete AI Agent')).not.toBeInTheDocument();
  });

  it('calls closeModalHandler when cancel button is clicked', () => {
    render(
      <DeleteAgentModal
        modalOpen={true}
        closeModalHandler={closeModalHandler}
        agentId={agentId}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    cancelButton.click();

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls mutateAsync when delete button is clicked', async () => {
    render(
      <DeleteAgentModal
        modalOpen={true}
        closeModalHandler={closeModalHandler}
        agentId={agentId}
      />
    );

    const deleteButton = screen.getByText('Delete Agent');
    deleteButton.click();

    expect(mutateAsync).toHaveBeenCalledWith({ agentId });
  });

  it('displays error notification if mutateAsync has error', () => {
    const errorMessage = 'Failed to delete agent';
    mutateAsync.mockRejectedValue(new Error(errorMessage));

    render(
      <DeleteAgentModal
        modalOpen={true}
        closeModalHandler={closeModalHandler}
        agentId={agentId}
      />
    );

    const deleteButton = screen.getByText('Delete Agent');
    deleteButton.click();

    waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'failed_operation',
        message: errorMessage,
      }));
    });
  });

  it('updates button text when loading', () => {
    mockDeleteAgent(true);

    render(
      <DeleteAgentModal
        modalOpen={true}
        closeModalHandler={closeModalHandler}
        agentId={agentId}
      />
    );

    const deleteButton = screen.getByText('Deleting Agent');

    expect(deleteButton).toBeInTheDocument();
  });
});
