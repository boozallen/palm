import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteSwearChecklistItem from '@/features/settings/api/ai-agents/swear/delete-swear-checklist-item';

type DeleteChecklistItemModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  itemId: string;
}>;

export default function DeleteChecklistItemModal({
  modalOpened,
  closeModalHandler,
  itemId,
}: DeleteChecklistItemModalProps) {
  const {
    mutateAsync: deleteSwearChecklistItem,
    isPending: deleteChecklistItemIsPending,
    error: deleteChecklistItemError,
  } = useDeleteSwearChecklistItem();

  const handleDeleteChecklistItem = async () => {
    try {
      await deleteSwearChecklistItem({ itemId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Remove checklist item failed',
        message: deleteChecklistItemError?.message ?? 'There was an error deleting the checklist item',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete SWEAR Checklist Item'
      data-test-id='delete-checklist-item-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this checklist item?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>
          Cancel
        </Button>
        <Button
          onClick={handleDeleteChecklistItem}
          loading={deleteChecklistItemIsPending}
        >
          {!deleteChecklistItemIsPending ? 'Delete Item' : 'Deleting Item'}
        </Button>
      </Group>
    </Modal>
  );
}
