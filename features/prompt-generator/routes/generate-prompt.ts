import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { queueGeneratePrompt } from '@/features/prompt-generator/services/queue-generate-prompt-service';

const generatePrompt = procedure
  .input(z.object({
    prompt: z.string().min(1, 'instructions are required'),
  }))
  .output(z.object({
    jobId: z.string(),
  }))
  .mutation(async ({ input, ctx }) => {
    return queueGeneratePrompt(input.prompt, ctx.userId);
  });

export default generatePrompt;
