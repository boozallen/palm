import { trpc } from '@/libs';

export default function useDeleteMessage() {
  const utils = trpc.useContext();

  return trpc.chat.deleteMessage.useMutation({
    onSuccess: (result, input) => {
      // Instead of invalidating the entire conversation, we can just remove the message from the list of messages
      //
      // Later if the deletion of a specific message also means that the conversation is then truncated, we can
      // update this to do that instead of just removing the message from the list of messages
      utils.chat.getMessages.setData({ chatId: input.chatId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        // Remove all messages after messagedAt
        return {
          ...oldData,
          messages: oldData.messages.filter((message) => message.messagedAt < result.messagedAt),
        };
      });
    },
  });
}
