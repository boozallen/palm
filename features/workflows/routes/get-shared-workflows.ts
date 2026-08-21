import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getSharedWorkflows from '@/features/workflows/dal/getSharedWorkflows';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { GetSharedWorkflowsResultSchema } from '@/features/workflows/types/shared-workflow';

export const getSharedWorkflowsRoute = procedure
  .output(GetSharedWorkflowsResultSchema)
  .query(async ({ ctx }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const { userId } = ctx;
    const userGroups = await getUserGroups(userId);
    const userGroupIds = userGroups.map((g) => g.id);

    return getSharedWorkflows({
      userId,
      userGroupIds,
    });
  });
