import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getGraphStats from '@/features/context-studio/dal/getGraphStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getGraphStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getGraphStats(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
    );
    return stats;
  });

export default getGraphStatsRoute;
