import { Worker } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { PlaygroundJobData } from '@/features/playground/utils/worker/playgroundQueue';
import { PlaygroundService } from '@/features/playground/services/playground';
import { AIFactory } from '@/features/ai-provider';
import { AiResponse } from '@/features/ai-provider/sources/types';
import { reportJobFailure } from '@/server/reportJobFailure';

let worker: Worker<PlaygroundJobData> | null = null;

export const startPlaygroundWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping playground queue/worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    throw new Error('Worker is already running');
  }

  worker = new Worker<PlaygroundJobData>(
    'playground-jobs',
    async (job) => {
      const { jobId, items, userId, userGroupId } = job.data;

      try {
        await storage.hset(`playground-job:${jobId}`, {
          status: 'processing',
          last_updated: Date.now(),
        });

        const ai = new AIFactory({ userId, userGroupId });
        const playgroundService = new PlaygroundService(ai);

        const results: AiResponse[] = [];
        for (const item of items) {
          const response = await playgroundService.playgroundPrompt(
            { exampleInput: item.exampleInput },
            item.config
          );
          results.push(response);
        }

        await storage.hset(`playground-job:${jobId}`, {
          status: 'done',
          results: JSON.stringify(results),
          last_updated: Date.now(),
        });
      } catch (error) {
        logger.error('Playground worker job failed', { jobId, error });
        await storage.hset(`playground-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          last_updated: Date.now(),
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on('completed', (job) => {
    logger.info(`Playground job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Playground job ${job?.id} failed:`, err);
    reportJobFailure(job, err);
  });

  logger.info('Playground worker started');
};
