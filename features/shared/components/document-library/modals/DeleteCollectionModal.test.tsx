import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';
import { InternalServerError } from '@/features/shared/errors/routeErrors';
import useDeleteCollection from '@/features/shared/api/document-collections/use-delete-collection';
import DeleteCollectionModal from '@/features/shared/components/document-library/modals/DeleteCollectionModal';

jest.mock('@/features/shared/api/document-collections/use-delete-collection');
jest.mock('@mantine/notifications');

describe('DeleteCollectionModal', () => {
  const deleteCollectionMock = jest.fn();
  const closeModalHandler = jest.fn();
  const onDeleteSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDeleteCollection as jest.Mock).mockReturnValue({
      mutateAsync: deleteCollectionMock,
      isPending: false,
      error: null,
    });
  });

  it('should render the modal with the correct props', () => {
    const modalOpened = true;
    const collectionId = 'collection-123';
    const collectionName = 'Test Collection';

    render(
      <DeleteCollectionModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        collectionId={collectionId}
        collectionName={collectionName}
      />
    );

    expect(screen.getByText('Delete Collection')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this collection? Documents will not be deleted.')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    const modalOpened = true;
    const collectionId = 'collection-123';
    const collectionName = 'Test Collection';

    render(
      <DeleteCollectionModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        collectionId={collectionId}
        collectionName={collectionName}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('should call the delete API when delete button is clicked', async () => {
    deleteCollectionMock.mockResolvedValue({});
    const modalOpened = true;
    const collectionId = 'collection-123';
    const collectionName = 'Test Collection';

    render(
      <DeleteCollectionModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        collectionId={collectionId}
        collectionName={collectionName}
        onDeleteSuccess={onDeleteSuccess}
      />
    );

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(deleteCollectionMock).toHaveBeenCalledTimes(1);
      expect(deleteCollectionMock).toHaveBeenCalledWith({ collectionId: 'collection-123' });
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Collection Deleted',
        message: 'Test Collection has been successfully deleted.',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
      expect(closeModalHandler).toHaveBeenCalledTimes(1);
      expect(onDeleteSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('should render notification on error', async () => {
    deleteCollectionMock.mockRejectedValue(InternalServerError('Failed to delete collection'));
    const modalOpened = true;
    const collectionId = 'collection-123';
    const collectionName = 'Test Collection';

    (useDeleteCollection as jest.Mock).mockReturnValue({
      mutateAsync: deleteCollectionMock,
      isPending: false,
      error: { message: 'Failed to delete collection' },
    });

    render(
      <DeleteCollectionModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        collectionId={collectionId}
        collectionName={collectionName}
      />
    );

    act(() => {
      fireEvent.click(screen.getByText('Delete'));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Delete Collection',
        message: 'Failed to delete collection',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    });
  });

  it('should display loading state while deleting', () => {
    (useDeleteCollection as jest.Mock).mockReturnValue({
      mutateAsync: deleteCollectionMock,
      isPending: true,
      error: null,
    });

    const modalOpened = true;
    const collectionId = 'collection-123';
    const collectionName = 'Test Collection';

    render(
      <DeleteCollectionModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        collectionId={collectionId}
        collectionName={collectionName}
      />
    );

    expect(screen.getByText('Deleting')).toBeInTheDocument();
  });

  it('should not render when modal is closed', () => {
    const modalOpened = false;
    const collectionId = 'collection-123';
    const collectionName = 'Test Collection';

    const { container } = render(
      <DeleteCollectionModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        collectionId={collectionId}
        collectionName={collectionName}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
