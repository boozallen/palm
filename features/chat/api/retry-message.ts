import { trpc } from '@/libs';

export default function retryMessage() {
  const utils = trpc.useContext();

  return trpc.chat.retryMessage.useMutation({
    onSuccess: (result, input) => {
     
        utils.chat.getMessages.setData({ chatId: input.chatId }, (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            messages: [...oldData.messages, ...result.messages],
          };
        });
      
    },
  });
}
