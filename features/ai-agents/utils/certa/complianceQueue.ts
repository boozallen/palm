import { Queue } from 'bullmq';

import logger from '@/server/logger';
import { getRedisClient } from '@/server/storage/redisConnection';

export interface ComplianceJobData {
  url: string;
  model: string;
  policies: Array<{ title: string; content: string; requirements: string }>;
  instructions: string;
  jobId: string;
  userId: string;
}

let complianceQueueInstance: Queue<ComplianceJobData> | null = null;

try {
  const connection = getRedisClient();

  complianceQueueInstance = new Queue<ComplianceJobData>('compliance-checks', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
} catch {
  logger.info('Redis not available — compliance queue not initialized.');
}

export const getComplianceQueue = (): Queue<ComplianceJobData> | null => {
  return complianceQueueInstance;
};

export const closeQueue = async (): Promise<void> => {
  try {
    const forceCloseTimeout = setTimeout(() => {
      logger.warn('Force closing queue after timeout');
      process.exit(0);
    }, 10000);

    if (complianceQueueInstance) {
      await complianceQueueInstance.close();
    }
    clearTimeout(forceCloseTimeout);
    logger.info('Compliance queue closed successfully');
  } catch (error) {
    logger.error('Error closing compliance queue:', error);
  }
};
