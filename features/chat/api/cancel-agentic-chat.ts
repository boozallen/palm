import { trpc } from '@/libs';
import { notifications } from '@mantine/notifications';

export default function useCancelAgenticChat(chatId?: string) {
  const utils = trpc.useUtils();

  return trpc.chat.cancelAgenticChat.useMutation({
    onSuccess: async (_data, variables) => {
      if (chatId) {
        await Promise.all([
          utils.chat.getMessages.invalidate({ chatId }),
          utils.chat.getChatJobStatus.invalidate({ chatId, jobId: variables.jobId }),
        ]);
      }
    },
    onError: () => {
      notifications.show({
        title: 'Could not stop job',
        message: 'Failed to cancel the running job. Please try again.',
        color: 'red',
      });
    },
  });
}
