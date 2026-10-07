import { trpc } from '@/libs';

export const useGetResearchJobStatus = (agentId: string, jobId: string | null) => {
  return trpc.aiAgents.getResearchJobStatus.useQuery(
    { agentId, jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: false,
    }
  );
};
