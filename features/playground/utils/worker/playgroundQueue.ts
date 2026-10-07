import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';
import { AiSettings } from '@/types';

export type PlaygroundJobItem = {
  exampleInput: string;
  config: AiSettings;
};

export type PlaygroundJobData = {
  jobId: string;
  items: PlaygroundJobItem[];
  userId: string;
  userGroupId?: string;
};

let playgroundQueue: Queue<PlaygroundJobData> | null = null;

export const getPlaygroundQueue = (): Queue<PlaygroundJobData> | null => {
  if (playgroundQueue) {
    return playgroundQueue;
  }

  try {
    const connection = getRedisClient();
    playgroundQueue = new Queue<PlaygroundJobData>('playground-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 1,
      },
    });

    logger.debug('Playground queue initialized successfully');
    return playgroundQueue;
  } catch (error) {
    logger.error('Could not initialize playground queue:', error);
    return null;
  }
};
