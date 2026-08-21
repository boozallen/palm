import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getAgentServiceStats from '@/features/context-studio/dal/getAgentServiceStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getAgentServiceStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getAgentServiceStats(
      input.timeRange,
      input.userGroupId,
      input.userId,
    );
    return stats;
  });

export default getAgentServiceStatsRoute;
