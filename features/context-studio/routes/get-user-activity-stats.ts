import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getUserActivityStats from '@/features/context-studio/dal/getUserActivityStats';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';

const getUserActivityStatsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    // Activity is Admin-only — a Lead's authority over their own group's cost
    // data doesn't extend to org-wide login/session activity.
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    const stats = await getUserActivityStats(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      input.excludeAdmins,
    );
    return stats;
  });

export default getUserActivityStatsRoute;
