import { trpc } from '@/libs';

export const useGetResearchJobResults = (agentId: string, jobId: string | null) => {
  return trpc.aiAgents.getResearchJobResults.useQuery(
    { agentId, jobId: jobId! },
    {
      enabled: false,
    }
  );
};
