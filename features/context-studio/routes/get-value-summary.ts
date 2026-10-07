import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getValueSummary from '@/features/context-studio/dal/getValueSummary';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import getStudioUserGroups from '@/features/context-studio/dal/getStudioUserGroups';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const getValueSummaryRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    // Value is Admin-only.
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    // byTeam must never name a group the viewer's own filter dropdown wouldn't offer.
    // getStudioUserGroups returns every group for an Admin, so an Admin's org-wide
    // view is unchanged; a plain member sees only their own groups. Resolved only on
    // the 'all' path — scopeStudioQuery has already read the same groups when a
    // specific one was requested, and that request is authorized by the time we
    // get here.
    const teamUserGroupIds = input.userGroupId !== 'all'
      ? [input.userGroupId]
      : (await getStudioUserGroups(ctx.userId, ctx.userRole === UserRole.Admin))
        .map((userGroup) => userGroup.id);
    // input.excludeAdmins is deliberately ignored — see the plan's Task 8 note.
    // Admin accounts inflate adoption while producing no delivery work, so every
    // number on this tab is defined with them out. Making it switchable would let
    // two readers of the same tab disagree about the same figure.
    const summary = await getValueSummary(
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      true,
      teamUserGroupIds,
    );
    return summary;
  });

export default getValueSummaryRoute;
