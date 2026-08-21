import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import { BaseJobData, DEFAULT_QUEUE_OPTIONS } from '@/features/ai-agents/utils/shared/types';

export interface CertaJobData extends BaseJobData {
  url: string;
  model: string;
  policies: Array<{ title: string; content: string; requirements: string }>;
  instructions: string;
}

let queue: Queue<CertaJobData> | null = null;

export const getCertaQueue = (): Queue<CertaJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<CertaJobData>('certa-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — CERTA queue not initialized.');
    return null;
  }
};
