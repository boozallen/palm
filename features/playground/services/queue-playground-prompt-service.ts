import { v4 as uuid } from 'uuid';

import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { getPlaygroundQueue, PlaygroundJobItem } from '@/features/playground/utils/worker/playgroundQueue';

export async function queuePlaygroundPrompt(
  items: PlaygroundJobItem[],
  userId: string,
  userGroupId: string | undefined,
): Promise<{ jobId: string }> {
  const jobId = uuid();
  const queue = getPlaygroundQueue();

  if (!queue) {
    throw new Error('Playground queue not available');
  }

  await storage.hset(`playground-job:${jobId}`, {
    status: 'queued',
    created: Date.now(),
    userId,
  });

  await queue.add('playgroundJob', { jobId, items, userId, userGroupId });

  logger.info('Playground job queued', { jobId, userId });

  return { jobId };
}
