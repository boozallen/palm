import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getKnowledgeBaseStats from '@/features/context-studio/dal/getKnowledgeBaseStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getKnowledgeBaseStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getKnowledgeBaseStats(
      input.timeRange,
      input.userGroupId,
      input.userId,
    );
    return stats;
  });

export default getKnowledgeBaseStatsRoute;
