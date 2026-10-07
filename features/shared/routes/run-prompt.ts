import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { PromptService } from '@/features/library/services/prompts';
import { AiSettingsSchema } from '@/types';
import { TRPCError, inferProcedureOutput } from '@trpc/server';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import resolveGroupScopedAiFactory from '@/features/shared/services/resolveGroupScopedAiFactory';

const runPrompt = procedure
  .input(z.object({
    instructions: z.string().min(1, 'instructions are required'),
    config: AiSettingsSchema,
    userGroupId: z.string().uuid().nullish(),
  }))
  .mutation(async ({ input, ctx }) => {
    const ai = await resolveGroupScopedAiFactory(ctx.userId, input.userGroupId);

    try {
      const promptService = new PromptService(ai);
      const response = await promptService.runPrompt(input);
      ctx.logger.debug('promptService.runPrompt: ', response);
      return response;
    } catch (error) {
      ctx.logger.error('runPrompt.mutation: ', error);
      if (error instanceof TRPCError) {
        throw error;
      } else {
        throw new Error(promptSubmissionErrorMessage);
      }
    }
  });

export default runPrompt;

export type RunPromptResponse = inferProcedureOutput<typeof runPrompt>;
