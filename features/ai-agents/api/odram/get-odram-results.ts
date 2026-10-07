import { trpc } from '@/libs';

export default function useOdramResults(agentId: string, jobId: string | null) {
  return trpc.aiAgents.getOdramResults.useQuery(
    { agentId, jobId: jobId! },
    { enabled: !!jobId },
  );
}
