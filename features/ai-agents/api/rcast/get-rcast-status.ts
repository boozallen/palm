import { trpc } from '@/libs';

export const useRcastStatus = (agentId: string, jobId: string | null) => {
  return trpc.aiAgents.getRcastStatus.useQuery(
    { agentId, jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: false,
    }
  );
};
