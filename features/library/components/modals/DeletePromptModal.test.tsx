import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import useDeletePrompt from '@/features/library/api/delete-prompt';
import DeletePromptModal from '@/features/library/components/modals/DeletePromptModal';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { InternalServerError } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/library/api/delete-prompt');
jest.mock('@mantine/notifications');

describe('DeletePromptModal', () => {
  const deletePromptMock = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();

    (useDeletePrompt as jest.Mock).mockReturnValue({
      mutateAsync: deletePromptMock,
      error: null,
    });
  });
  it('should renders the modal with the correct props', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

    render(
      <DeletePromptModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        promptId={promptId}
      />
    );

    expect(screen.getByText('Confirm Prompt Deletion')).toBeInTheDocument();
    expect(screen.getByText('You are about to delete this prompt. Are you sure you want to proceed?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

    render(
      <DeletePromptModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        promptId={promptId}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('should calls the delete API when delete button is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

    render(
      <DeletePromptModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        promptId={promptId}
      />
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(deletePromptMock).toHaveBeenCalledTimes(1);
  });

  it('should render notification on error', async () => {
    deletePromptMock.mockRejectedValue(InternalServerError('Failed to delete prompt'));
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

    render(
      <DeletePromptModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        promptId={promptId}
      />
    );

    act(() => {
      fireEvent.click(screen.getByText('Delete'));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Delete Prompt Failed',
        message: 'An unexpected error occurred',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });

  });

});
