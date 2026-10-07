import { trpc } from '@/libs';

export function useGetPlaygroundStatus(jobId: string | null) {
  return trpc.playground.getPlaygroundStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return !status || status === 'queued' || status === 'processing' ? 2000 : false;
      },
    }
  );
}
