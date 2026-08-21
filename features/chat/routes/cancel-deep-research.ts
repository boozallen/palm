import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { getDeepResearchQueue } from '@/features/ai-provider/sources/deep-research/deepResearchQueue';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';

const inputSchema = z.object({
  jobId: z.string(),
});

export default procedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    const { jobId } = input;

    try {
      const redis = getRedisClient();
      const cancellationKey = `deep-research:cancel:${jobId}`;
      
      await redis.setex(cancellationKey, 600, '1');

      const queue = getDeepResearchQueue();
      if (queue) {
        const job = await queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          if (state === 'waiting' || state === 'delayed') {
            await job.remove();
          }
        }
      } else {
        logger.error('CANCEL ERROR: Deep research queue not available');
      }
      return { success: true, message: 'Job cancellation initiated' };
    } catch (error) {
      logger.error('CANCEL FAILED: Failed to cancel deep research job:', error);
      throw new Error('Failed to cancel deep research job');
    }
  });
