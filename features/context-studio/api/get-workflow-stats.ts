import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetWorkflowStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getWorkflowStats.useQuery({
    timeRange,
    userGroupId,
    userId,
  }, {
    enabled: isSubmitted,
  });
}
