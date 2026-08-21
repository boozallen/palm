import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getArtifactStats from '@/features/context-studio/dal/getArtifactStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getArtifactStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getArtifactStats(
      input.timeRange,
      input.userGroupId,
      input.userId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getArtifactStatsRoute;
