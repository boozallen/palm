import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';

export const getChatJobStatus = procedure
  .input(z.object({ chatId: z.string().uuid(), jobId: z.string() }))
  .query(async ({ input }) => {
    const [job, messages] = await Promise.all([
      storage.hgetall(`chat-job:${input.jobId}`),
      storage.lrange(`chat-job-progress:${input.jobId}`, 0, -1),
    ]);

    if (!job.status) {
      throw new Error('Job not found');
    }

    return {
      status: job.status as string,
      messages,
      created: job.created as string,
      completed: job.completed as string | undefined,
      error: job.error ? (job.error as string) : null,
    };
  });
