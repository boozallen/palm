import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { queueRenderJob } from '@/features/video-generation/services/render-to-mp4-service';

const input = z.object({
  slidesJson: z.string().min(1),
});

const output = z.object({
  jobId: z.string(),
});

export const renderToMp4 = procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input: { slidesJson } }) => {
    return queueRenderJob(slidesJson, ctx.userId);
  });
