import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { getGeneratePromptJobStatus } from '@/features/prompt-generator/services/get-generate-prompt-status-service';

const input = z.object({
  jobId: z.string().min(1),
});

const output = z.object({
  status: z.enum(['queued', 'processing', 'done', 'error']),
  response: z.object({
    text: z.string(),
    inputTokensUsed: z.number(),
    outputTokensUsed: z.number(),
    embeddings: z.array(
      z.object({
        embedding: z.array(z.number()),
      })
    ).optional(),
  }).optional(),
  error: z.string().optional(),
});

export const getGeneratePromptStatus = procedure
  .input(input)
  .output(output)
  .query(async ({ input: { jobId } }) => {
    return getGeneratePromptJobStatus(jobId);
  });
