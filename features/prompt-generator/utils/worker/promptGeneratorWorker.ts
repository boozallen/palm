import { Worker } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { PromptGeneratorJobData } from '@/features/prompt-generator/utils/worker/promptGeneratorQueue';
import { PromptService } from '@/features/library/services/prompts';
import { AIFactory } from '@/features/ai-provider';
import { reportJobFailure } from '@/server/reportJobFailure';

let worker: Worker<PromptGeneratorJobData> | null = null;

export const startPromptGeneratorWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping prompt generator queue/worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    throw new Error('Worker is already running');
  }

  worker = new Worker<PromptGeneratorJobData>(
    'prompt-generator-jobs',
    async (job) => {
      const { jobId, prompt, userId } = job.data;

      try {
        await storage.hset(`prompt-generator-job:${jobId}`, {
          status: 'processing',
          last_updated: Date.now(),
        });

        const ai = new AIFactory({ userId });
        const promptService = new PromptService(ai);

        const response = await promptService.generatePrompt(prompt);

        await storage.hset(`prompt-generator-job:${jobId}`, {
          status: 'done',
          response: JSON.stringify(response),
          last_updated: Date.now(),
        });
      } catch (error) {
        logger.error('Prompt generator worker job failed', { jobId, error });
        await storage.hset(`prompt-generator-job:${jobId}`, {
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
    logger.info(`Prompt generator job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Prompt generator job ${job?.id} failed:`, err);
    reportJobFailure(job, err);
  });

  logger.info('Prompt generator worker started');
};
