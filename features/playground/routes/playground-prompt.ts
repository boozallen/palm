import { procedure } from '@/server/trpc';
import { AiSettingsSchema } from '@/types';
import { z } from 'zod';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import logger from '@/server/logger';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';
import { queuePlaygroundPrompt } from '@/features/playground/services/queue-playground-prompt-service';

const inputSchema = z.object({
  items: z.array(
    z.object({
      exampleInput: z.string().min(1, 'an example is required'),
      config: AiSettingsSchema,
    })
  ),
  userGroupId: z.string().uuid().nullish(),
});

const outputSchema = z.object({
  jobId: z.string(),
});

const playgroundPrompt = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const validatedUserGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);

    try {
      return await queuePlaygroundPrompt(input.items, ctx.userId, validatedUserGroupId ?? undefined);
    } catch (error) {
      logger.error(promptSubmissionErrorMessage, error);
      throw new Error(promptSubmissionErrorMessage);
    }
  });

export default playgroundPrompt;
