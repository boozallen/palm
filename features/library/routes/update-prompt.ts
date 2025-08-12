import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getPrompt from '@/features/library/dal/getPrompt';
import updatePrompt from '@/features/library/dal/updatePrompt';
import { PromptSchema } from '@/features/shared/types';
import logger from '@/server/logger';

const inputSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  instructions: z.string(),
  example: z.string(),
  model: z.string(),
  randomness: z.number(),
  repetitiveness: z.number(),
  tags: z.array(z.string()),
});

const outputSchema = PromptSchema.extend({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {

    const promptToUpdate = await getPrompt(input.id);

    if (ctx.userRole !== UserRole.Admin && ctx.userId !== promptToUpdate.creatorId) {
      logger.error(`You do not have permission to edit this prompt. userId: ${ctx.userId}, promptId: ${promptToUpdate.id}`);
      throw Forbidden('You do not have permission to edit this prompt.');
    }

    const updatedPrompt = await updatePrompt(input);

    return {
      id: updatedPrompt.id,
      creatorId: updatedPrompt.creatorId,
      title: updatedPrompt.title,
      summary: updatedPrompt.summary,
      description: updatedPrompt.description,
      instructions: updatedPrompt.instructions,
      example: updatedPrompt.example,
      tags: updatedPrompt.tags,
      config: {
        model: updatedPrompt.config.model,
        randomness: updatedPrompt.config.randomness,
        repetitiveness: updatedPrompt.config.repetitiveness,
      },
    };
  });
