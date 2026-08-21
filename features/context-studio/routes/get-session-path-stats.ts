import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getSessionPathStats from '@/features/context-studio/dal/getSessionPathStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getSessionPathStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    // Every path's sampleUser is named unconditionally, not only when a specific
    // userId is requested, so 'all' is forced down to the viewer's own id unless
    // they are an Admin or that group's Lead.
    const stats = await getSessionPathStats(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getSessionPathStatsRoute;
