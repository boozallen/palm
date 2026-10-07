import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import ManageCollectionsModal from '@/features/shared/components/document-library/modals/ManageCollectionsModal';
import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import useCreateCollection from '@/features/shared/api/document-collections/use-create-collection';
import useUpdateCollection from '@/features/shared/api/document-collections/use-update-collection';

jest.mock('@/features/shared/api/document-collections/use-get-collections');
jest.mock('@/features/shared/api/document-collections/use-create-collection');
jest.mock('@/features/shared/api/document-collections/use-update-collection');
jest.mock('@mantine/notifications');

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
      {component}
    </MantineProvider>
  );
};

describe('ManageCollectionsModal', () => {
  const closeModalHandler = jest.fn();
  const createCollectionMock = jest.fn();
  const updateCollectionMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetCollections as jest.Mock).mockReturnValue({
      data: {
        collections: [
          { id: 'collection-1', name: 'Research', color: '#228BE6', documentCount: 3 },
        ],
      },
    });

    (useCreateCollection as jest.Mock).mockReturnValue({
      mutateAsync: createCollectionMock,
      isPending: false,
    });

    (useUpdateCollection as jest.Mock).mockReturnValue({
      mutateAsync: updateCollectionMock,
      isPending: false,
    });
  });

  it('shows a green success checkmark notification after a folder is created', async () => {
    createCollectionMock.mockResolvedValue({});

    renderWithMantine(
      <ManageCollectionsModal modalOpened closeModalHandler={closeModalHandler} />
    );

    fireEvent.change(screen.getByPlaceholderText('Collection name'), { target: { value: 'New Folder' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(createCollectionMock).toHaveBeenCalledWith({ name: 'New Folder', color: '#228BE6' });
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Success',
        message: 'Collection created',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
    });
  });

  it('shows a failure notification when creating a folder fails', async () => {
    createCollectionMock.mockRejectedValue(new Error('failed'));

    renderWithMantine(
      <ManageCollectionsModal modalOpened closeModalHandler={closeModalHandler} />
    );

    fireEvent.change(screen.getByPlaceholderText('Collection name'), { target: { value: 'New Folder' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Error',
        message: 'Failed to create collection',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

  it('shows a green success checkmark notification after a folder is renamed', async () => {
    updateCollectionMock.mockResolvedValue({});

    renderWithMantine(
      <ManageCollectionsModal modalOpened closeModalHandler={closeModalHandler} />
    );

    fireEvent.click(screen.getByTestId('collection-start-edit-collection-1'));

    const nameInput = screen.getByDisplayValue('Research');
    fireEvent.change(nameInput, { target: { value: 'Research Renamed' } });

    fireEvent.click(screen.getByTestId('collection-save-edit-collection-1'));

    await waitFor(() => {
      expect(updateCollectionMock).toHaveBeenCalledWith({
        collectionId: 'collection-1',
        name: 'Research Renamed',
        color: '#228BE6',
      });
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Success',
        message: 'Collection updated',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });
    });
  });
});
