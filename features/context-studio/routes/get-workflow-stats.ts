import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getWorkflowStats from '@/features/context-studio/dal/getWorkflowStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getWorkflowStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getWorkflowStats(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
    );
    return stats;
  });

export default getWorkflowStatsRoute;
