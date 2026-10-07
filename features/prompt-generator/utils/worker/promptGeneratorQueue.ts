import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';

export type PromptGeneratorJobData = {
  jobId: string;
  prompt: string;
  userId: string;
};

let promptGeneratorQueue: Queue<PromptGeneratorJobData> | null = null;

export const getPromptGeneratorQueue = (): Queue<PromptGeneratorJobData> | null => {
  if (promptGeneratorQueue) {
    return promptGeneratorQueue;
  }

  try {
    const connection = getRedisClient();
    promptGeneratorQueue = new Queue<PromptGeneratorJobData>('prompt-generator-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 1,
      },
    });

    logger.debug('Prompt generator queue initialized successfully');
    return promptGeneratorQueue;
  } catch (error) {
    logger.error('Could not initialize prompt generator queue:', error);
    return null;
  }
};
