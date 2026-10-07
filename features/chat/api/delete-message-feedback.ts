import { trpc } from '@/libs';

export default function useDeleteMessageFeedback() {
  const utils = trpc.useContext();

  return trpc.chat.deleteMessageFeedback.useMutation({
    onSuccess: (result, input) => {
      utils.chat.getMessages.setData({ chatId: input.chatId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          ...oldData,
          messages: oldData.messages.map((message) =>
            message.id === result.chatMessageId ? { ...message, feedback: null } : message
          ),
        };
      });
    },
  });
}
