import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetAgentServiceStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getAgentServiceStats.useQuery({
    timeRange,
    userGroupId,
    userId,
  }, {
    enabled: isSubmitted,
  });
}
