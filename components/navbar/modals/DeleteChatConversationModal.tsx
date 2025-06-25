import { Modal, Text, Button, Group } from '@mantine/core';
import { useDeleteChat } from '@/features/chat/api/delete-chat';
import { IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import router from 'next/router';

type DeleteChatModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  chatId: string | null;
}>;

export default function DeleteChatModal({ modalOpened, closeModalHandler, chatId }: DeleteChatModalProps) {

  const { mutateAsync: deleteChat, error: deleteChatError } = useDeleteChat();

  const handleDeleteChat = async () => {
    if (chatId) {
      try {
        await deleteChat({ chatId: chatId });
        closeModalHandler();
        router.push('/chat');
      } catch (error) {
        notifications.show({
          title: 'Delete Chat Failed',
          message: deleteChatError ? deleteChatError.message : 'An unexpected error occurred. Please try again later.',
          icon: <IconX />,
          autoClose: true,
          variant: 'failed_operation',
        });
      }
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Confirm chat deletion'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        You are about to delete your chat. Are you sure you want to proceed?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleDeleteChat}>Delete</Button>
      </Group>
    </Modal>
  );
}
