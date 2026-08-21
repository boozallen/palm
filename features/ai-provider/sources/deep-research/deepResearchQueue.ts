import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';

export interface DeepResearchJobData {
  jobId: string;
  userId: string;
  chatId: string;
  messageId: string | null;
  modelId: string;
  input: string;
  maxToolCalls?: number;
  instructions?: string;
  searchHash?: string;
}

let deepResearchQueueInstance: Queue<DeepResearchJobData> | null = null;

export const getDeepResearchQueue = (): Queue<DeepResearchJobData> | null => {
  if (deepResearchQueueInstance) {
    return deepResearchQueueInstance;
  }

  try {
    const connection = getRedisClient();
    deepResearchQueueInstance = new Queue<DeepResearchJobData>('deep-research-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
      },
    });
    logger.info('Deep research queue initialized successfully');
    return deepResearchQueueInstance;
  } catch (error) {
    logger.info('Redis not available — deep research queue not initialized.');
    return null;
  }
};

export const closeDeepResearchQueue = async (): Promise<void> => {
  try {
    const forceCloseTimeout = setTimeout(() => {
      logger.warn('Force closing deep research queue after timeout');
      process.exit(0);
    }, 10000);

    if (deepResearchQueueInstance) {
      await deepResearchQueueInstance.close();
    }
    clearTimeout(forceCloseTimeout);
    logger.info('Deep research queue closed successfully');
  } catch (error) {
    logger.error('Error closing deep research queue:', error);
  }
};