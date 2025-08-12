import { z } from 'zod';
import logger from '@/server/logger';

import updateUserKbSettingsMinScore from '@/features/profile/dal/updateUserKbSettingsMinScore';
import { procedure } from '@/server/trpc';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  knowledgeBasesMinScore: z.number().nullable(),
});

const outputSchema = z.object({
  knowledgeBasesMinScore: z.number().nullable(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;

    if (!userId) {
      logger.warn('Unauthorized attempt to update knowledge bases min score');
      throw Unauthorized('You do not have permission to access this resource');
    }

    const updatedUser = await updateUserKbSettingsMinScore(userId, input.knowledgeBasesMinScore);

    return { knowledgeBasesMinScore: updatedUser.knowledgeBasesMinScore };
  });
