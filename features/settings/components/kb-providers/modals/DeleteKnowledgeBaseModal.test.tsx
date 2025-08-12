import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteKnowledgeBaseModal from './DeleteKnowledgeBaseModal';
import useDeleteKnowledgeBase from '@/features/settings/api/delete-knowledge-base';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/delete-knowledge-base', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
  })),
}));

describe('DeleteKnowledgeBaseModal', () => {
  const closeModalHandler = jest.fn();
  const knowledgeBaseId = '123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const deleteKnowledgeBaseMock = jest.fn();
  (useDeleteKnowledgeBase as jest.Mock).mockReturnValue({
    mutateAsync: deleteKnowledgeBaseMock,
    error: undefined,
  });

  it('renders the modal with the correct props', () => {
    const modalOpen = true;

    render(
      <DeleteKnowledgeBaseModal
        modalOpen={modalOpen}
        closeModalHandler={closeModalHandler}
        knowledgeBaseId={knowledgeBaseId}
      />
    );

    expect(screen.getByText('Delete Knowledge Base')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this Knowledge Base?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('does not render modal if modalOpen is false', () => {
    const modalOpen = false;

    render(
      <DeleteKnowledgeBaseModal
        modalOpen={modalOpen}
        closeModalHandler={closeModalHandler}
        knowledgeBaseId={knowledgeBaseId}
      />
    );

    expect(screen.queryByText('Delete Knowledge Base')).not.toBeInTheDocument();
    expect(screen.queryByText('Are you sure you want to delete this Knowledge Base?')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    const modalOpen = true;

    render(
      <DeleteKnowledgeBaseModal
        modalOpen={modalOpen}
        closeModalHandler={closeModalHandler}
        knowledgeBaseId={knowledgeBaseId}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the delete API when delete button is clicked', () => {
    const modalOpen = true;

    render(
      <DeleteKnowledgeBaseModal
        modalOpen={modalOpen}
        closeModalHandler={closeModalHandler}
        knowledgeBaseId={knowledgeBaseId}
      />
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(deleteKnowledgeBaseMock).toHaveBeenCalledTimes(1);
  });

  it('displays notification toast upon error', async () => {
    const errorMessage = 'Could not delete knowledge base';

    (useDeleteKnowledgeBase as jest.Mock).mockReturnValue({
      mutateAsync: deleteKnowledgeBaseMock.mockRejectedValue(new Error(errorMessage)),
      error: new Error(errorMessage),
    });

    const modalOpen = true;

    render(
      <DeleteKnowledgeBaseModal
        modalOpen={modalOpen}
        closeModalHandler={closeModalHandler}
        knowledgeBaseId={knowledgeBaseId}
      />
    );

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(deleteKnowledgeBaseMock).toBeCalled();
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Delete Knowledge Base',
        message: errorMessage || 'There was a problem deleting the knowledge base',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });
});
