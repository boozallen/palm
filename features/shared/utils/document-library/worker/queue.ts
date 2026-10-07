import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import { DEFAULT_QUEUE_OPTIONS } from '@/features/ai-agents/utils/shared/types';

export interface GraphCopyJobData {
  jobId: string;
  userId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  filename: string;
}

let queue: Queue<GraphCopyJobData> | null = null;

export const getGraphCopyQueue = (): Queue<GraphCopyJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<GraphCopyJobData>('graph-copy-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — Graph Copy queue not initialized.');
    return null;
  }
};
