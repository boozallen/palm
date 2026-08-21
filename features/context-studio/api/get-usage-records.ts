import { trpc } from '@/libs';
import { InitiatedBy } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetUsageRecords(
  initiatedBy: InitiatedBy,
  aiProvider: string,
  model: string,
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  isSubmitted: boolean,
) {
  return trpc.contextStudio.getUsageRecords.useQuery({
    initiatedBy,
    aiProvider,
    model,
    timeRange,
    userGroupId,
    userId,
  }, {
    enabled: isSubmitted,
  });
}
