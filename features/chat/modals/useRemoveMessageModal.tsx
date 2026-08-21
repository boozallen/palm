import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';
import useDeleteMessage from '@/features/chat/api/delete-message';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

interface RemoveMessageModalOutput {
  removeMessage: (messageId: string) => void;
}

export function useRemoveMessageModal(chatId: string) {
  const { mutateAsync: deleteMessage, error } = useDeleteMessage();

  function removeMessage(messageId: string) {
    modals.openConfirmModal({
      title: 'Confirm message deletion',
      centered: true,
      children: (
        <Text color='gray.7' fz='sm' mb='md'>
          Deleting will remove this message and all subsequent messages. Are you sure you want to proceed?
        </Text>
      ),
      labels: {
        confirm: 'Delete',
        cancel: 'Cancel',
      },
      cancelProps: { variant: 'outline' },
      confirmProps: {},
      groupProps: { spacing: 'lg', grow: true },
      withCloseButton: false,
      // TODO: resolve Promise
      onConfirm: async () => {
        try {
          await deleteMessage({ messageId, chatId });
        } catch (e) {
          notifications.show({
            title: 'Delete User Chat Message Failed',
            message: error ? error.message : 'An unexpected error occurred. Please try again later.',
            icon: <IconX />,
            autoClose: false,
            withCloseButton: true,
            variant: 'failed_operation',
          });
        }
      },
    });
  }

  return { removeMessage } as RemoveMessageModalOutput;
}
