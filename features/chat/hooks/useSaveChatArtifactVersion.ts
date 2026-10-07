import { trpc } from '@/libs';

export const useSaveChatArtifactVersion = (chatId: string) => {
  const utils = trpc.useUtils();

  return trpc.chat.saveArtifactVersion.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ chatId });
      utils.chat.getArtifactVersions.invalidate();
    },
  });
};
