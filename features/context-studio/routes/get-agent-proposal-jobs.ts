import { procedure } from '@/server/trpc';
import { contextStudioQuerySchema } from '@/features/context-studio/types/context-studio';
import getAgentProposalJobs from '@/features/context-studio/dal/getAgentProposalJobs';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';

const getAgentProposalJobsRoute = procedure
  .input(contextStudioQuerySchema)
  .query(async ({ ctx, input }) => {
    // AI Agents is Admin-only.
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    return getAgentProposalJobs(input.timeRange, input.userGroupId, restrictedUserId);
  });

export default getAgentProposalJobsRoute;
