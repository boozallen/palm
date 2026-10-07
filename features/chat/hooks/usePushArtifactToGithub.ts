import { trpc } from '@/libs';

export const usePushArtifactToGithub = (chatId: string) => {
  const utils = trpc.useUtils();

  return trpc.chat.pushArtifactToGithub.useMutation({
    onSuccess: (data) => {
      if (data.pagesUrl) {
        utils.chat.getMessages.invalidate({ chatId });
      }
    },
  });
};
