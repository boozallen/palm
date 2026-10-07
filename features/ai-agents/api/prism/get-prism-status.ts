import { trpc } from '@/libs';

export default function usePrismStatus(agentId: string, jobId: string | null) {
  return trpc.aiAgents.getPrismStatus.useQuery(
    { agentId, jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === 'completed' || data?.status === 'error') {
          return false;
        }
        return 3000;
      },
      refetchIntervalInBackground: true,
    },
  );
}
