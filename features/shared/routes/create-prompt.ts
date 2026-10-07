import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { PromptSchema } from '@/features/shared/types';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import createPrompt from '@/features/shared/dal/createPrompt';

const inputSchema = z.object({
  prompt: PromptSchema,
});

const outputSchema = z.object({
  prompt: PromptSchema.extend({
    id: z.string().uuid(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.userId) {
      throw Unauthorized('You do not have permission to access this resource');
    }

    const result = await createPrompt({
      prompt: { ...input.prompt, creatorId: ctx.userId },
    });

    const output: z.infer<typeof outputSchema> = {
      prompt: {
        ...result,
      },
    };

    return output;
  });
