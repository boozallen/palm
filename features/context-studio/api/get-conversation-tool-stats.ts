import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetConversationToolStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins: boolean,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getConversationToolStats.useQuery({
    timeRange,
    userGroupId,
    userId,
    excludeAdmins,
  }, {
    enabled: isSubmitted,
  });
}
