import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import { BaseJobData, DEFAULT_QUEUE_OPTIONS } from '@/features/ai-agents/utils/shared/types';

export interface RadarJobData extends BaseJobData {
  dateStart: string;
  dateEnd: string;
  model: string;
  categories: string[];
  institutions: string[];
  searchHash: string;
}

let queue: Queue<RadarJobData> | null = null;

export const getRadarQueue = (): Queue<RadarJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<RadarJobData>('radar-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — RADAR queue not initialized.');
    return null;
  }
};
