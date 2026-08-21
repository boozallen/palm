import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import {
  BaseJobData,
  DEFAULT_QUEUE_OPTIONS,
} from '@/features/ai-agents/utils/shared/types';

export interface PrismJobData extends BaseJobData {
  requirementsFileKey: string;
  requirementsFilename: string;
  proposalFileKey: string;
  proposalFilename: string;
  proposalContentType: string;
  documentUploadProviderId: string;
  modelId: string;
}

let queue: Queue<PrismJobData> | null = null;

export const getPrismQueue = (): Queue<PrismJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<PrismJobData>('prism-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — PRISM queue not initialized.');
    return null;
  }
};
