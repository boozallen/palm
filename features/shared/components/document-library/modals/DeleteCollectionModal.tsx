import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';
import useDeleteCollection from '@/features/shared/api/document-collections/use-delete-collection';

type DeleteCollectionModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  collectionId: string;
  collectionName: string;
  onDeleteSuccess?: () => void;
}>;

export default function DeleteCollectionModal({
  modalOpened,
  closeModalHandler,
  collectionId,
  collectionName,
  onDeleteSuccess,
}: DeleteCollectionModalProps) {
  const { mutateAsync: deleteCollection, isPending: isDeleting, error: deleteError } = useDeleteCollection();

  const handleDeleteCollection = async () => {
    try {
      await deleteCollection({ collectionId });

      notifications.show({
        title: 'Collection Deleted',
        message: `${collectionName} has been successfully deleted.`,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: true,
      });

      closeModalHandler();
      onDeleteSuccess?.();
    } catch (error) {
      notifications.show({
        title: 'Failed to Delete Collection',
        message: deleteError?.message ?? 'There was a problem deleting the collection',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    }
  };

  if (!modalOpened) {
    return null;
  }

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete Collection'
      data-testid='delete-collection-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this collection? Documents will not be deleted.
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>
          Cancel
        </Button>
        <Button onClick={handleDeleteCollection} loading={isDeleting} disabled={isDeleting}>
          {isDeleting ? 'Deleting' : 'Delete'}
        </Button>
      </Group>
    </Modal>
  );
}
