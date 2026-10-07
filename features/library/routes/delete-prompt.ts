import { z } from 'zod';
import { procedure } from '@/server/trpc';
import deletePrompt from '@/features/library/dal/deletePrompt';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import getPrompt from '@/features/library/dal/getPrompt';
import logger from '@/server/logger';

const inputSchema = z.object({
  promptId: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { promptId } = input;

    const promptToDelete = await getPrompt(promptId);

    if (ctx.userRole !== UserRole.Admin && ctx.userId !== promptToDelete.creatorId) {
      logger.error(`You do not have permission to delete this prompt: userId: ${ctx.userId}, promptId: ${promptToDelete.id}`);
      throw Forbidden('You do not have permission to delete this prompt');
    }

    const result = await deletePrompt(promptId);

    return {
      id: result.id,
    };
  });
