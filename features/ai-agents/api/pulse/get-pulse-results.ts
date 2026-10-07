import { trpc } from '@/libs';

export default function usePulseResults(agentId: string, jobId: string | null) {
  return trpc.aiAgents.getPulseResults.useQuery(
    { agentId, jobId: jobId! },
    { enabled: !!jobId },
  );
}
