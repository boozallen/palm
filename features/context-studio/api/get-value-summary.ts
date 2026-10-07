import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

// No excludeAdmins parameter: the route excludes them unconditionally. See the
// plan's Task 8 note — accepting one here and having the server ignore it is how
// a future switch gets wired to a no-op.
export default function useGetValueSummary(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  isEnabled: boolean,
) {
  return trpc.contextStudio.getValueSummary.useQuery({
    timeRange,
    userGroupId,
    userId,
    excludeAdmins: true,
  }, {
    enabled: isEnabled,
  });
}
