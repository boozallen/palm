import { trpc } from '@/libs';

export default function useGetSharedWorkflows() {
  return trpc.workflows.getSharedWorkflows.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) {
        return false;
      }

      const hasPendingSharedWorkflows = data.incoming && data.incoming.length > 0;

      return hasPendingSharedWorkflows ? 3000 : false;
    },
    refetchOnWindowFocus: true,
  });
}
