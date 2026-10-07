import { trpc } from '@/libs';

export function useDeleteChat() {
  const utils = trpc.useContext();
  return trpc.chat.deleteChat.useMutation({
    onSuccess: async () => {
      await utils.chat.getChats.invalidate();
    },
  });
}
