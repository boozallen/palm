import { procedure } from '@/server/trpc';
import { useCaseQuerySchema } from '@/features/context-studio/types/context-studio';
import getUseCaseThemeInputs from '@/features/context-studio/dal/getUseCaseThemeInputs';
import getUseCaseThemes from '@/features/context-studio/dal/getUseCaseThemes';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';

const getUseCaseThemesRoute = procedure
  .input(useCaseQuerySchema)
  .query(async ({ ctx, input }) => {
    // The roll-up reads chat titles, owner names and message excerpts, so 'all' is
    // forced down to the viewer's own id unless they are an Admin or the group's Lead.
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);
    // excludeAdmins is deliberately ignored, matching the detail route it shares a
    // drawer with — the two must analyze the same chats to describe the same dollars.
    const chats = await getUseCaseThemeInputs(
      input.useCase,
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      true,
    );

    return getUseCaseThemes(
      input.useCase,
      chats,
      ctx.userId,
      input.userGroupId === 'all' ? undefined : input.userGroupId,
    );
  });

export default getUseCaseThemesRoute;
