import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { PromptService } from '@/features/library/services/prompts';
import { AiResponse } from '@/features/ai-provider/sources/types';

const generatePrompt = procedure
  .input(z.object({
    prompt: z.string().min(1, 'instructions are required'),
  }))
  .mutation(async ({ input, ctx }) => {
    const promptService = new PromptService(ctx.ai);

    let response: AiResponse;

    response = await promptService.generatePrompt(input.prompt);

    return response;
  });

export default generatePrompt;
