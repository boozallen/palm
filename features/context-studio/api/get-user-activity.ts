import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetUserActivity(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins: boolean,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getUserActivity.useQuery({
    timeRange,
    userGroupId,
    userId,
    excludeAdmins,
  }, {
    enabled: isSubmitted,
  });
}
