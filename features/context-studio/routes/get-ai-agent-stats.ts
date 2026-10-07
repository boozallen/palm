import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getAiAgentStats from '@/features/context-studio/dal/getAiAgentStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';

const getAiAgentStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    // AI Agents is Admin-only.
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getAiAgentStats(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
    );
    return stats;
  });

export default getAiAgentStatsRoute;
