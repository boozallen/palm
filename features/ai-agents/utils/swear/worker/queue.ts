import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import {
  BaseJobData,
  DEFAULT_QUEUE_OPTIONS,
} from '@/features/ai-agents/utils/shared/types';

export interface SwearJobData extends BaseJobData {
  documentText: string;
  modelId: string;
  filename: string;
}

let queue: Queue<SwearJobData> | null = null;

export const getSwearQueue = (): Queue<SwearJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<SwearJobData>('swear-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — SWEAR queue not initialized.');
    return null;
  }
};
