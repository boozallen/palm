import { trpc } from '@/libs';

export default function usePulseStatus(agentId: string, jobId: string | null) {
  return trpc.aiAgents.getPulseStatus.useQuery(
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
