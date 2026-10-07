import { trpc } from '@/libs';

export default function useRateMessage() {
  const utils = trpc.useContext();

  return trpc.chat.rateMessage.useMutation({
    onSuccess: (result, input) => {
      utils.chat.getMessages.setData({ chatId: input.chatId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          ...oldData,
          messages: oldData.messages.map((message) =>
            message.id === result.chatMessageId
              ? { ...message, feedback: { rating: result.rating, comment: result.comment, issueType: result.issueType } }
              : message
          ),
        };
      });
    },
  });
}
