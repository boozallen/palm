import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { getRenderJobStatus } from '@/features/video-generation/services/get-render-status-service';

const input = z.object({
  jobId: z.string().min(1),
});

const output = z.object({
  status: z.enum(['queued', 'processing', 'done', 'error']),
  progress: z.string().optional(),
  downloadUrl: z.string().optional(),
  error: z.string().optional(),
});

export const getRenderStatus = procedure
  .input(input)
  .output(output)
  .query(async ({ input: { jobId } }) => {
    return getRenderJobStatus(jobId);
  });
