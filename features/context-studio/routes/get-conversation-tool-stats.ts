import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getConversationToolStats from '@/features/context-studio/dal/getConversationToolStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getConversationToolStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getConversationToolStats(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getConversationToolStatsRoute;
