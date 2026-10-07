import { trpc } from '@/libs';

export default function usePrismResults(agentId: string, jobId: string | null) {
  return trpc.aiAgents.getPrismResults.useQuery(
    { agentId, jobId: jobId! },
    { enabled: !!jobId },
  );
}
