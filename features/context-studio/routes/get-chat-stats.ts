import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getChatStats from '@/features/context-studio/dal/getChatStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getChatStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getChatStats(
      input.timeRange,
      input.userGroupId,
      input.userId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getChatStatsRoute;
