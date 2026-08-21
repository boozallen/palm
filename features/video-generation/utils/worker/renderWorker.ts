import { Worker } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { RenderJobData } from '@/features/video-generation/utils/worker/renderQueue';
import { renderSlidesToMp4 } from '@/features/video-generation/utils/worker/render-pipeline';
import type { VideoSlide } from '@/features/video-generation/types/video.types';

let worker: Worker<RenderJobData> | null = null;

export const startRenderWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping render queue/worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    throw new Error('Worker is already running');
  }

  worker = new Worker<RenderJobData>(
    'video-render-jobs',
    async (job) => {
      const { jobId, slidesJson, theme, userId } = job.data;

      try {
        await storage.hset(`render-job:${jobId}`, {
          status: 'processing',
          progress: 'Rendering: 0%',
          last_updated: Date.now(),
        });

        const slides = JSON.parse(slidesJson) as VideoSlide[];

        const onProgress = async (pct: number): Promise<void> => {
          await storage.hset(`render-job:${jobId}`, {
            progress: `Rendering: ${Math.round(pct * 100)}%`,
            last_updated: Date.now(),
          });
        };

        const downloadUrl = await renderSlidesToMp4(slides, userId, jobId, onProgress, theme);

        await storage.hset(`render-job:${jobId}`, {
          status: 'done',
          downloadUrl,
          progress: '100%',
          last_updated: Date.now(),
        });
      } catch (error) {
        logger.error('Render worker job failed', { jobId, error });
        await storage.hset(`render-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          last_updated: Date.now(),
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 600000,
    },
  );

  worker.on('completed', (job) => {
    logger.info(`Render job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Render job ${job?.id} failed:`, err);
  });

  logger.info('Render worker started');
};
