import { trpc } from '@/libs';

export default function useUpdateChatConversationSummary() {
  const utils = trpc.useContext();

  return trpc.chat.updateChatConversationSummary.useMutation({
    onSuccess: (data, input) => {
      utils.chat.getUserChat.setData(
        { chatId: input.chatId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            summary: data.summary,
          };
        }
      );

      utils.chat.getChats.invalidate();
    },
  });
}
