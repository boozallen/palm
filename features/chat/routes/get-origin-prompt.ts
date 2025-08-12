import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import getOriginPrompt from '@/features/chat/dal/getOriginPrompt';

const inputSchema = z.object({
  promptId: z.string().uuid(),
});

const outputSchema = z.object({
  prompt: z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    instructions: z.string(),
    example: z.string(),
  }).required(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    const { promptId } = input;

    const prompt = await getOriginPrompt(promptId);

    // perform an ownership check if the creatorId is not the same as the current user
    if (!!prompt.creatorId && ctx.userRole !== UserRole.Admin && prompt.creatorId !== ctx.userId) {
      logger.error(`You do not have permission to view this prompt: userId: ${ctx.userId}, promptId: ${prompt.id}`);
      throw new Error('You do not have permission to view this prompt');
    }

    return {
      prompt: {
        id: prompt.id,
        title: prompt.title,
        description: prompt.description,
        instructions: prompt.instructions,
        example: prompt.example,
      },
    };
  });
