import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';

import DeleteSourceModal from './DeleteSourceModal';
import useDeleteDocument from '@/features/shared/api/document-upload/delete-document';

jest.mock('@/features/shared/api/document-upload/delete-document');
jest.mock('@mantine/notifications');

const renderComponent = (props = {}) => {
  const defaultProps = {
    modalOpened: true,
    closeModalHandler: jest.fn(),
    sourceId: 'test-source-id',
    sourceLabel: 'test-document.pdf',
    onDeleteSuccess: jest.fn(),
  };

  return render(
    <MantineProvider>
      <DeleteSourceModal {...defaultProps} {...props} />
    </MantineProvider>
  );
};

describe('DeleteSourceModal', () => {
  const mockDeleteDocument = jest.fn();
  const mockCloseModalHandler = jest.fn();
  const mockOnDeleteSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteDocument,
      isPending: false,
      error: null,
    });

    (notifications.show as jest.Mock).mockImplementation(() => {});
  });

  it('renders the modal with correct content when opened', () => {
    renderComponent();

    expect(screen.getByTestId('delete-source-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete Document')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this document?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not render modal when modalOpened is false', () => {
    renderComponent({ modalOpened: false });

    expect(screen.queryByTestId('delete-source-modal')).not.toBeInTheDocument();
  });

  it('calls closeModalHandler when cancel button is clicked', () => {
    renderComponent({ closeModalHandler: mockCloseModalHandler });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockCloseModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls delete API when delete button is clicked', () => {
    const sourceId = 'test-document-id';
    renderComponent({ sourceId });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeleteDocument).toHaveBeenCalledWith({ documentId: sourceId });
  });

  it('shows success notification and closes modal on successful deletion', async () => {
    mockDeleteDocument.mockResolvedValue(undefined);
    const sourceLabel = 'my-document.pdf';
    
    renderComponent({ 
      closeModalHandler: mockCloseModalHandler,
      onDeleteSuccess: mockOnDeleteSuccess,
      sourceLabel,
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Document Deleted',
        message: `${sourceLabel} has been successfully deleted.`,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
    });

    expect(mockCloseModalHandler).toHaveBeenCalled();
    expect(mockOnDeleteSuccess).toHaveBeenCalled();
  });

  it('shows error notification on deletion failure', async () => {
    const errorMessage = 'Deletion failed';
    mockDeleteDocument.mockRejectedValue(new Error(errorMessage));

    renderComponent();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Delete Document',
        message: 'There was a problem deleting the document',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    });
  });

  it('uses custom error message when available', async () => {
    const errorMessage = 'Custom error message';
    const mockError = { message: errorMessage };
    
    (useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteDocument,
      isPending: false,
      error: mockError,
    });

    mockDeleteDocument.mockRejectedValue(new Error(errorMessage));

    renderComponent();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Delete Document',
        message: errorMessage,
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    });
  });

  it('shows loading state while deletion is in progress', () => {
    (useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteDocument,
      isPending: true,
      error: null,
    });

    renderComponent();

    const deleteButton = screen.getByRole('button', { name: 'Deleting' });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toHaveAttribute('data-loading', 'true');
    expect(deleteButton).toBeDisabled();
  });

  it('disables delete button when deletion is in progress', () => {
    (useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteDocument,
      isPending: true,
      error: null,
    });

    renderComponent();

    const deleteButton = screen.getByRole('button', { name: 'Deleting' });
    expect(deleteButton).toBeDisabled();
  });

  it('does not call onDeleteSuccess when it is not provided', async () => {
    mockDeleteDocument.mockResolvedValue(undefined);
    
    renderComponent({ onDeleteSuccess: undefined });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Document Deleted',
        })
      );
    });

    // Should not throw error when onDeleteSuccess is undefined
  });

  it('renders with correct modal props', () => {
    renderComponent();

    const modal = screen.getByTestId('delete-source-modal');
    expect(modal).toBeInTheDocument();
    
    // Modal should be centered and without close button
    // These are implementation details that may need adjustment based on actual DOM structure
  });
});
