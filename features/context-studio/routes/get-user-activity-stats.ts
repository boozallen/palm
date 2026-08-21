import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getUserActivityStats from '@/features/context-studio/dal/getUserActivityStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getUserActivityStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getUserActivityStats(
      input.timeRange,
      input.userGroupId,
      input.userId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getUserActivityStatsRoute;
