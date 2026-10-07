import { procedure } from '@/server/trpc';
import { useCaseQuerySchema } from '@/features/context-studio/types/context-studio';
import getUseCaseDetail from '@/features/context-studio/dal/getUseCaseDetail';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getUseCaseDetailRoute = procedure
  .input(useCaseQuerySchema)
  .query(async ({ ctx, input }) => {
    // The drawer names individual chats and owners unconditionally, so 'all' is
    // forced down to the viewer's own id unless they are an Admin or the group's Lead.
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    // excludeAdmins is deliberately ignored: every figure on this tab is defined with
    // admins out, and making it switchable would let two readers disagree on one number.
    const detail = await getUseCaseDetail(
      input.useCase,
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      true,
    );
    return detail;
  });

export default getUseCaseDetailRoute;
