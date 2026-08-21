import { trpc } from '@/libs';

export default function useStartOdramAnalysis() {
  return trpc.aiAgents.startOdramAnalysis.useMutation();
}

export function useGetOdramUploadUrls() {
  return trpc.aiAgents.getOdramUploadUrls.useMutation();
}

export function useOdramStatus(agentId: string, jobId: string | null) {
  return trpc.aiAgents.getOdramStatus.useQuery(
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
