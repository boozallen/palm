import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import {
  BaseJobData,
  DEFAULT_QUEUE_OPTIONS,
} from '@/features/ai-agents/utils/shared/types';

// The queue a PULSE run belongs to, and the route its error records are filed under.
export const PULSE_QUEUE_NAME = 'pulse-jobs';

export interface PulseJobData extends BaseJobData {
  surveyFileKey: string;
  surveyFilename: string;
  surveyContentType: string;
  documentUploadProviderId: string;
  modelId: string;
}

let queue: Queue<PulseJobData> | null = null;

export const getPulseQueue = (): Queue<PulseJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<PulseJobData>(PULSE_QUEUE_NAME, {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — PULSE queue not initialized.');
    return null;
  }
};
