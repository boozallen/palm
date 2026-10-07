import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';

export type RenderJobData = {
  jobId: string;
  slidesJson: string;
  theme?: string;
  userId: string;
};

let renderQueue: Queue<RenderJobData> | null = null;

export const getRenderQueue = (): Queue<RenderJobData> | null => {
  if (renderQueue) {
    return renderQueue;
  }

  try {
    const connection = getRedisClient();
    renderQueue = new Queue<RenderJobData>('video-render-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 15000,
        },
      },
    });

    logger.debug('Render queue initialized successfully');
    return renderQueue;
  } catch (error) {
    logger.error('Could not initialize render queue:', error);
    return null;
  }
};
