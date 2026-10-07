import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getChatTranscript from '@/features/context-studio/dal/getChatTranscript';
import isChatInUseCaseScope from '@/features/context-studio/dal/isChatInUseCaseScope';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { useCaseQuerySchema } from '@/features/context-studio/types/context-studio';
import { NotFound } from '@/features/shared/errors/routeErrors';

const getChatTranscriptRoute = procedure
  .input(useCaseQuerySchema.extend({ chatId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // The transcript quotes a whole conversation, so 'all' is forced down to the
    // viewer's own id unless they are an Admin or the group's Lead.
    const { restrictedUserId } = await scopeStudioQuery(ctx, input.userGroupId, input.userId);

    // getChatTranscript takes a bare chatId and scopes nothing itself, so the id has
    // to be checked against the list that offered it — otherwise a validated filter
    // would let any grant-holder read any chat in the org by id.
    const inScope = await isChatInUseCaseScope(
      input.chatId,
      input.useCase,
      input.timeRange,
      input.userGroupId,
      restrictedUserId,
      true,
    );

    // Not Forbidden: a chat outside the viewer's scope shouldn't be confirmed to exist.
    if (!inScope) {
      throw NotFound('Chat transcript not found');
    }

    return getChatTranscript(input.chatId, input.userGroupId);
  });

export default getChatTranscriptRoute;
