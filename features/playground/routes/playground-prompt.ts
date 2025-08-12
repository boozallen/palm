import { PlaygroundService } from '@/features/playground/services/playground';
import { procedure } from '@/server/trpc';
import { AiSettingsSchema } from '@/types';
import { z } from 'zod';
import { AiResponse } from '@/features/ai-provider/sources/types';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import logger from '@/server/logger';

const inputSchema = z.array(
  z.object({
    exampleInput: z.string().min(1, 'an example is required'),
    config: AiSettingsSchema,
  })
);

const outputSchema = z.object({
  aiResponse: z.array(
    z.object({
      text: z.string(),
      inputTokensUsed: z.number(),
      outputTokensUsed: z.number(),
      embeddings: z.array(
        z.object({
          embedding: z.array(z.number()),
        })
      ).optional(),
    })
  ),
});

const playgroundPrompt = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const results: AiResponse[] = [];
    try {
      const playgroundService = new PlaygroundService(ctx.ai);
      for (const item of input) {
        const response = await playgroundService.playgroundPrompt(
          { exampleInput: item.exampleInput },
          item.config
        );
        results.push(response);
      }

      const output: z.infer<typeof outputSchema> = {
        aiResponse: results,
      };

      return output;
    } catch (error) {
      logger.error(promptSubmissionErrorMessage, error);
      throw new Error(promptSubmissionErrorMessage);
    }
  });

export default playgroundPrompt;
