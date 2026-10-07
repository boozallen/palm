import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export default function useGetAgentProposalJobs(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  enabled: boolean,
) {
  return trpc.contextStudio.getAgentProposalJobs.useQuery({
    timeRange,
    userGroupId,
    userId,
  }, {
    enabled,
  });
}
