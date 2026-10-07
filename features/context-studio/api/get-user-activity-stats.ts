import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetUserActivityStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins: boolean,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getUserActivityStats.useQuery({
    timeRange,
    userGroupId,
    userId,
    excludeAdmins,
  }, {
    enabled: isSubmitted,
  });
}
