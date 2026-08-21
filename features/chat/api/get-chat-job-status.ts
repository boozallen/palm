import { trpc } from '@/libs';

export const useGetChatJobStatus = (jobId?: string, chatId?: string) => {
  return trpc.chat.getChatJobStatus.useQuery(
    {
      chatId: chatId || '',
      jobId: jobId!,
    },
    {
      enabled: !!jobId && !!chatId,
      refetchInterval: (query) => {
        // Stop polling if status is completed or error
        const data = query.state.data;
        if (data?.status === 'completed' || data?.status === 'error') {
          return false;
        }
        return 500; // Poll every 500ms
      },
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: false,
    }
  );
};
