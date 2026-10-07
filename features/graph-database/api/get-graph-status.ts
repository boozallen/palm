import { trpc } from '@/libs';
import { GraphBuildStatus } from '@/features/graph-database/types';

/**
 * Get graph build status and progress
 * Used for polling during graph construction
 * Automatically stops polling when status is Completed, Failed, or Cancelled
 *
 * @param graphId - The graph ID to query (optional - query disabled if not provided)
 */
export const useGetGraphStatus = (graphId?: string) => {
  return trpc.graph.getGraphStatus.useQuery(
    { graphId: graphId! },
    {
      enabled: !!graphId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (
          data?.status === GraphBuildStatus.Completed ||
          data?.status === GraphBuildStatus.Failed ||
          data?.status === GraphBuildStatus.Cancelled
        ) {
          return false;
        }
        return 2000; // Poll every 2 seconds while building
      },
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: false,
    }
  );
};
