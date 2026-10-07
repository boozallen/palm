import { trpc } from '@/libs';

export function useGetGraphCopyStatus(jobId: string | null, options?: { enabled?: boolean }) {
  return trpc.shared.getGraphCopyStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId && (options?.enabled ?? true),
      refetchInterval: (query) => {
        const data = query.state.data;
        // Stop polling when job is completed or errored
        if (data?.status === 'completed' || data?.status === 'error') {
          return false;
        }
        // Poll every 2 seconds while processing
        return 2000;
      },
    }
  );
}
