import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteKnowledgeBase from '@/features/settings/api/delete-knowledge-base';

type DeleteKnowledgeBaseModalProps = Readonly<{
  modalOpen: boolean;
  closeModalHandler: () => void;
  knowledgeBaseId: string;
}>;

export default function DeleteKnowledgeBaseModal({ modalOpen, closeModalHandler, knowledgeBaseId }: DeleteKnowledgeBaseModalProps) {

  const {
    mutateAsync: deleteKnowledgeBase,
    isPending: deleteKnowledgeBaseIsPending,
    error: deleteKnowledgeBaseError,
  } = useDeleteKnowledgeBase();

  const handleDeleteKnowledgeBase = async () => {
    try {
      await deleteKnowledgeBase({ id: knowledgeBaseId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Failed to Delete Knowledge Base',
        message: deleteKnowledgeBaseError?.message ?? 'There was a problem deleting the knowledge base',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={modalOpen}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete Knowledge Base'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this Knowledge Base?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteKnowledgeBase} loading={deleteKnowledgeBaseIsPending}>
          {deleteKnowledgeBaseIsPending ? 'Deleting' : 'Delete'}
        </Button>
      </Group>
    </Modal>
  );
}
