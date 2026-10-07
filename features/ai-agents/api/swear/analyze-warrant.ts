import { trpc } from '@/libs';

export default function useAnalyzeWarrant() {
  return trpc.aiAgents.analyzeWarrant.useMutation();
}

export function useSwearStatus(agentId: string, jobId: string | null) {
  return trpc.aiAgents.getSwearStatus.useQuery(
    { agentId, jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const data = query.state.data;
        // Stop polling when job is completed or errored
        if (data?.status === 'completed' || data?.status === 'error') {
          return false;
        }
        // Poll every 3 seconds while processing
        return 3000;
      },
    }
  );
}
