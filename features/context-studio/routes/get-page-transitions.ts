import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getPageTransitions from '@/features/context-studio/dal/getPageTransitions';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getPageTransitionsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getPageTransitions(
      input.timeRange,
      input.userGroupId,
      input.userId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getPageTransitionsRoute;
