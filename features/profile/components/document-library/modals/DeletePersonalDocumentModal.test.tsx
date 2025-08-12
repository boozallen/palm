import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import DeletePersonalDocumentModal from './DeletePersonalDocumentModal';
import useDeleteDocument from '@/features/shared/api/document-upload/delete-document';

jest.mock('@mantine/notifications');
jest.mock('@/features/shared/api/document-upload/delete-document');

type DeletePersonalDocumentModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  documentId: string;
}>;

const renderModal = (props: DeletePersonalDocumentModalProps) => {
  render(
    <DeletePersonalDocumentModal
      modalOpened={props.modalOpened}
      closeModalHandler={props.closeModalHandler}
      documentId={props.documentId}
    />
  );
};

describe('DeletePersonalDocumentModal', () => {
  const closeModalHandler = jest.fn();
  const mockDeleteDocument = jest.fn();
  const documentId = 'f66b2688-a077-4b01-be8e-3cedbc879906';

  let modalOpened = true;

  (useDeleteDocument as jest.Mock).mockReturnValue({
    mutateAsync: mockDeleteDocument,
    isPending: false,
    error: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with the correct props', () => {
    renderModal({ modalOpened, closeModalHandler, documentId });

    expect(screen.getByText('Delete Document')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this document?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    renderModal({ modalOpened, closeModalHandler, documentId });

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the deletePersonalDocument API when delete button is clicked', async () => {
    renderModal({ modalOpened, closeModalHandler, documentId });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledTimes(1);
      expect(mockDeleteDocument).toHaveBeenCalledWith({ documentId });
    });
  });

  it('displays a notification toast upon error', async () => {
    const mockError = new Error('Could not delete document');

    (useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteDocument.mockRejectedValue(mockError),
      isPending: false,
      error: mockError,
    });

    renderModal({ modalOpened, closeModalHandler, documentId });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteDocument).toBeCalled();
    });

    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Failed to Delete Document',
      message: mockError.message || 'There was a problem deleting the document',
      icon: <IconX />,
      autoClose: false,
      variant: 'failed_operation',
    });
  });
});
