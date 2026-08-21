import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getDocumentStats from '@/features/context-studio/dal/getDocumentStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getDocumentStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getDocumentStats(
      input.timeRange,
      input.userGroupId,
      input.userId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getDocumentStatsRoute;
