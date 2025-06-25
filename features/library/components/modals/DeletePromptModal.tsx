import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeletePrompt from '@/features/library/api/delete-prompt';

type DeletePromptModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  promptId: string;
}>;

export default function DeletePromptModal({ modalOpened, closeModalHandler, promptId }: DeletePromptModalProps) {

  const { mutateAsync: deletePrompt, error: deletePromptError } = useDeletePrompt();
  const handleDeletePrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePrompt({ promptId: promptId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Delete Prompt Failed',
        message: deletePromptError ? deletePromptError.message : 'An unexpected error occurred',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeModalHandler();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      closeModalHandler();
    }
    event.stopPropagation();
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Confirm Prompt Deletion'
      centered
      onKeyDown={handleKeyDown}
    >
      <Text color='gray.7' fz='sm' mb='md'>
        You are about to delete this prompt. Are you sure you want to proceed?  
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleClose}>Cancel</Button>
        <Button onClick={handleDeletePrompt}>Delete</Button>
      </Group>
    </Modal>
  );
}
