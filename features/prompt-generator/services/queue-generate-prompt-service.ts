import { v4 as uuid } from 'uuid';

import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { getPromptGeneratorQueue } from '@/features/prompt-generator/utils/worker/promptGeneratorQueue';

export async function queueGeneratePrompt(
  prompt: string,
  userId: string,
): Promise<{ jobId: string }> {
  const jobId = uuid();
  const queue = getPromptGeneratorQueue();

  if (!queue) {
    throw new Error('Prompt generator queue not available');
  }

  await storage.hset(`prompt-generator-job:${jobId}`, {
    status: 'queued',
    created: Date.now(),
    userId,
  });

  await queue.add('promptGeneratorJob', { jobId, prompt, userId });

  logger.info('Prompt generator job queued', { jobId, userId });

  return { jobId };
}
