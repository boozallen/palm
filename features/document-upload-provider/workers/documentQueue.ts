import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';

export type DocumentJobData = {
  documentId: string;
  documentUploadProviderId: string;
  jobId: string;
  userId: string;
  fileKey: string;
  fileName: string;
  contentType: string;
  fileSize: number;
};

let documentQueue: Queue<DocumentJobData> | null = null;

export const getDocumentQueue = (): Queue<DocumentJobData> | null => {
  if (documentQueue) {
    return documentQueue;
  }

  try {
    const connection = getRedisClient();
    documentQueue = new Queue<DocumentJobData>('document-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 15000,
        },
      },
    });

    logger.debug('Document queue initialized successfully');
    return documentQueue;
  } catch (error) {
    logger.error('Could not initialize document queue:', error);
    return null;
  }
};
