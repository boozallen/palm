import { trpc } from '@/libs';
import { InitiatedBy, TimeRange } from '@/features/settings/types/analytics';

export default function useGetUsageRecords(
  initiatedBy: InitiatedBy,
  aiProvider: string,
  model: string,
  timeRange: TimeRange,
  isSubmitted: boolean,
) {
  return trpc.settings.getUsageRecords.useQuery({
    initiatedBy,
    aiProvider,
    model,
    timeRange,
  }, {
    enabled: isSubmitted,
  });
}
