import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetAiAgentStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getAiAgentStats.useQuery({
    timeRange,
    userGroupId,
    userId,
  }, {
    enabled: isSubmitted,
  });
}
