import { z } from 'zod';

import updateUserKbSettingsMaxResults from '@/features/profile/dal/updateUserKbSettingsMaxResults';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

const inputSchema = z.object({
  knowledgeBasesMaxResults: z.number().min(1).max(20).nullable(),
});

const outputSchema = z.object({
  knowledgeBasesMaxResults: z.number().nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;

    if (!userId) {
      logger.warn('Unauthorized attempt to update knowledge bases max results');
      throw Unauthorized('You do not have permission to access this resource');
    }

    const updatedUser = await updateUserKbSettingsMaxResults(userId, input.knowledgeBasesMaxResults);

    return { knowledgeBasesMaxResults: updatedUser.knowledgeBasesMaxResults };
  });
