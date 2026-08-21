import { trpc } from '@/libs';
import { DeepResearchStatus } from '@/features/chat/types/message';

export const useGetDeepResearchStatus = (jobId?: string, chatId?: string, messageId?: string) => {
  return trpc.chat.getDeepResearchStatus.useQuery(
    { 
      chatId: chatId || '',
      jobId: jobId!,
      messageId: messageId!,
    },
    {
      enabled: !!jobId && !!chatId && !!messageId,
      refetchInterval: (query) => {
        // Stop polling if status is completed, failed, or cancelled
        const data = query.state.data;
        if (data?.status === DeepResearchStatus.COMPLETED || 
            data?.status === DeepResearchStatus.FAILED ||
            data?.status === DeepResearchStatus.CANCELLED) {
          return false;
        }
        return 1000;
      },
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: false,
    }
  );
};
