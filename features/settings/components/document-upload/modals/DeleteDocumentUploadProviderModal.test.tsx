import { notifications } from '@mantine/notifications';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import DeleteDocumentUploadProviderModal from './DeleteDocumentUploadProviderModal';
import useDeleteDocumentUploadProvider from '@/features/settings/api/document-upload/delete-document-upload-provider';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/document-upload/delete-document-upload-provider');

describe('DeleteDocumentUploadProviderModal', () => {
  const closeModalHandler = jest.fn();
  const mutateAsync = jest.fn();
  const providerId = 'provider-id-1';

  beforeEach(() => {
    jest.clearAllMocks();
    (useDeleteDocumentUploadProvider as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });
  });

  it('renders modal if opened', () => {
    const opened = true;

    render(
      <DeleteDocumentUploadProviderModal
        opened={opened}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    expect(screen.getByText('Delete Document Upload Provider')).toBeInTheDocument();
  });

  it('does not render modal if not opened', () => {
    const opened = false;

    render(
      <DeleteDocumentUploadProviderModal
        opened={opened}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    expect(screen.queryByText('Delete Document Upload Provider')).not.toBeInTheDocument();
  });

  it('renders confirmation text', () => {
    const opened = true;

    render(
      <DeleteDocumentUploadProviderModal
        opened={opened}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    expect(screen.queryByText(/are you sure/i)).toBeInTheDocument();
  });

  it('renders buttons', () => {
    const opened = true;

    render(
      <DeleteDocumentUploadProviderModal
        opened={opened}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const deleteButton = screen.getByRole('button', { name: 'Delete Provider' });

    expect(cancelButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('calls closeModalHandler when cancel button is clicked', () => {
    const opened = true;

    render(
      <DeleteDocumentUploadProviderModal
        opened={opened}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    cancelButton.click();

    expect(closeModalHandler).toHaveBeenCalled();
  });

  it('calls mutateAsync with providerId on delete', async () => {
    render(
      <DeleteDocumentUploadProviderModal
        opened={true}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete Provider/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ providerId });
    });
  });

  it('shows loading state on delete', () => {
    (useDeleteDocumentUploadProvider as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: true,
    });

    render(
      <DeleteDocumentUploadProviderModal
        opened={true}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    expect(screen.getByRole('button', { name: /Deleting/i })).toHaveAttribute('data-loading');
  });

  it('shows error message if mutation throws', async () => {
    mutateAsync.mockRejectedValueOnce(
      new Error('Failed to delete provider')
    );

    render(
      <DeleteDocumentUploadProviderModal
        opened={true}
        closeModalHandler={closeModalHandler}
        providerId={providerId}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete Provider/i }));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        id: 'delete-document-upload-provider-error',
        message: 'Failed to delete provider',
        variant: 'failed_operation',
      }));
    });
  });
});
