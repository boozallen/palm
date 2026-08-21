import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getUserActivity from '@/features/context-studio/dal/getUserActivity';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getUserActivityRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getUserActivity(
      input.timeRange,
      input.userGroupId,
      input.userId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getUserActivityRoute;
