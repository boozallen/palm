import { trpc } from '@/libs';

export default function useCancelDeepResearch(chatId?: string) {
  const utils = trpc.useUtils();
  
  return trpc.chat.cancelDeepResearch.useMutation({
    onSuccess: async () => {
      // Invalidate queries after successful cancellation
      if (chatId) {
        await Promise.all([
          utils.chat.getMessages.invalidate({ chatId }),
          utils.chat.getDeepResearchStatus.invalidate(),
        ]);
      }
    },
    onError: (error) => {
      console.error('Failed to cancel deep research:', error);
    },
  });
}