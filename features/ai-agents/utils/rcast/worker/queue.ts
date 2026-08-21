import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import {
  BaseJobData,
  DEFAULT_QUEUE_OPTIONS,
} from '@/features/ai-agents/utils/shared/types';

export interface RcastJobData extends BaseJobData {
  rateCardId: string;
  modelId: string;
}

let queue: Queue<RcastJobData> | null = null;

export const getRcastQueue = (): Queue<RcastJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<RcastJobData>('rcast-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — RCAST-TWO queue not initialized.');
    return null;
  }
};
