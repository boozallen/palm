import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { getPlaygroundJobStatus } from '@/features/playground/services/get-playground-status-service';

const input = z.object({
  jobId: z.string().min(1),
});

const output = z.object({
  status: z.enum(['queued', 'processing', 'done', 'error']),
  results: z.array(
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
  ).optional(),
  error: z.string().optional(),
});

export const getPlaygroundStatus = procedure
  .input(input)
  .output(output)
  .query(async ({ input: { jobId } }) => {
    return getPlaygroundJobStatus(jobId);
  });
