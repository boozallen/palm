import { z } from 'zod';

import { procedure } from '@/server/trpc';
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
  .query(async ({ input }) => {
    const { promptId } = input;

    const prompt = await getOriginPrompt(promptId);

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
