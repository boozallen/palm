import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { getChatQueue } from '@/features/chat/utils/worker/queue';
import { getRedisClient } from '@/server/storage/redisConnection';
import { Forbidden, InternalServerError } from '@/features/shared/errors/routeErrors';
import cancelChatMessage from '@/features/chat/dal/cancelChatMessage';
import logger from '@/server/logger';

const inputSchema = z.object({
  jobId: z.string(),
});

export default procedure
  .input(inputSchema)
  .mutation(async ({ input, ctx }) => {
    const { jobId } = input;

    const queue = getChatQueue();
    if (!queue) {
      logger.error('[CANCEL] Chat queue not available');
      throw InternalServerError('Chat queue not available');
    }

    const job = await queue.getJob(jobId);
    if (job) {
      if (job.data.userId !== ctx.userId) {
        throw Forbidden('You do not have permission to cancel this job');
      }

      const redis = getRedisClient();
      await redis.setex(`chat-job:cancel:${jobId}`, 600, '1');

      const state = await job.getState();
      if (state === 'waiting' || state === 'delayed') {
        await job.remove();
        try {
          await cancelChatMessage(job.data.messageId);
        } catch (dbError) {
          logger.error('[CANCEL] Failed to update message status after job removal:', dbError);
        }
      }
    }

    return { success: true, message: 'Job cancellation initiated' };
  });
