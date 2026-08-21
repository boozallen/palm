import { trpc } from '@/libs';

export default function useUpdateMessage() {
  const utils = trpc.useUtils();

  return trpc.chat.updateMessage.useMutation({
    onSuccess: (data) => {
      utils.chat.getMessages.setData(
        { chatId: data.chatId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          };
          return {
            ...oldData,
            messages: oldData.messages.map((message) =>
              message.id === data.chatMessageId
                ? { ...message, ...data }
                : message,
            ),
          };
        }
      );
    },
  });
}
