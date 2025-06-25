import { trpc } from '@/libs';

export default function useCreateChat() {
  const utils = trpc.useContext();

  return trpc.chat.createChat.useMutation({
    onSuccess: (data) => {
      utils.chat.getChats.invalidate();
      utils.chat.getUserChat.setData({ chatId: data.chat.id }, data);
    },
  });
}
