import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetPromptStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins: boolean,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getPromptStats.useQuery({
    timeRange,
    userGroupId,
    userId,
    excludeAdmins,
  }, {
    enabled: isSubmitted,
  });
}
