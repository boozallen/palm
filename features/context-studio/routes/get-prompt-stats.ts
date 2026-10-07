import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getPromptStats from '@/features/context-studio/dal/getPromptStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getPromptStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getPromptStats(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getPromptStatsRoute;
