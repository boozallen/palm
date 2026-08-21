import { trpc } from '@/libs';
import { GraphBuildStatus } from '@/features/graph-database/types';

export function useGetActiveGraphBuilds() {
  const query = trpc.graph.getActiveGraphBuilds.useQuery(
    undefined,
    {
      refetchInterval: (query) => {
        // If there are any active builds, poll every 3 seconds
        const data = query.state.data;
        if (!data) {
          return false; 
        }
        const hasActiveBuilds = data.some(
          (build) => build.status === GraphBuildStatus.Pending ||
                    build.status === GraphBuildStatus.Building ||
                    build.status === GraphBuildStatus.Resolving ||
                    build.status === GraphBuildStatus.Cancelling
        );
        return hasActiveBuilds ? 3000 : false;
      },
    }
  );
  return query;
}