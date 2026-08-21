import { trpc } from '@/libs';

export default function useCreateChat() {
  const utils = trpc.useContext();

  return trpc.chat.createChat.useMutation({
    onSuccess: (data) => {
      utils.chat.getChats.invalidate();
      utils.chat.getUserChat.setData({ chatId: data.chat.id }, {
        chat: {
          id: data.chat.id,
          modelId: data.chat.modelId,
          agentProviderId: data.chat.agentProviderId,
          promptId: data.chat.promptId,
          summary: data.chat.summary,
          externalSessionId: null,
          createdAt: data.chat.createdAt,
          updatedAt: data.chat.updatedAt,
        },
      });
    },
  });
}
