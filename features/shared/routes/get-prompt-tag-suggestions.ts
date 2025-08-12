import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { PromptSchema } from '@/features/shared/types';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import generatePromptTagSuggestions from '@/features/shared/system-ai/generatePromptTagSuggestions';

const inputSchema = z.object({
  prompt: PromptSchema,
});

const outputSchema = z.object({
  tags: z.array(z.string()),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.userId) {
      throw Unauthorized('You do not have permission to access this resource');
    }

    const response = await generatePromptTagSuggestions(ctx.ai, {
      prompt: {
        title: input.prompt.title,
        summary: input.prompt.summary,
        description: input.prompt.description,
        instructions: input.prompt.instructions,
        example: input.prompt.example,
        // tags: input.prompt.tags,
        // config: input.prompt.config,
      },
    });

    const output: z.infer<typeof outputSchema> = {
      tags: response.tags,
    };

    return output;
  });
