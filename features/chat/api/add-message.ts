import { trpc } from '@/libs';

export default function addMessage() {
  const utils = trpc.useContext();

  return trpc.chat.addMessage.useMutation({
    onSuccess: (result, input) => {
      // Replace the placeholder message with the new messages
      utils.chat.getMessages.setData({ chatId: input.chatId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        // Add the new message to the list of messages
        return {
          ...oldData,
          messages: [
            ...oldData.messages.filter(
              (message) => message.id !== 'placeholder'
            ),
            ...result.messages,
          ],
        };
      });
      utils.chat.getChats.invalidate();
    },
  });
}
