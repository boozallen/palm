import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getActivityStrips from '@/features/context-studio/dal/getActivityStrips';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getActivityStripsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    // Every matched user's name/session is named unconditionally, not only when
    // a specific userId is requested, so 'all' is forced down to the viewer's
    // own id unless they are an Admin or that group's Lead.
    const stats = await getActivityStrips(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      input.excludeAdmins,
      // The signed-in viewer is pinned to the top of the swimlane.
      ctx.userId,
    );
    return stats;
  });

export default getActivityStripsRoute;
