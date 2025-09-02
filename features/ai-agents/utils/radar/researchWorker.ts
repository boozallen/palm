import { Worker } from 'bullmq';
import Bottleneck from 'bottleneck';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { ResearchJobData } from '@/features/ai-agents/utils/radar/researchQueue';
import { performResearchAnalysis } from '@/features/ai-agents/utils/radar/researchAnalysis';
import { getRedisClient } from '@/server/storage/redisConnection';
import {
  generateCacheKey,
  generateActiveJobKey,
} from '@/features/ai-agents/utils/radar/searchHash';

const sharedLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 5000,
});

let worker: Worker | null = null;
let shutdownInProgress = false;

const CACHE_TTL = 24 * 60 * 60;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down research worker...`);

  try {
    await storage.del('worker:research:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down research worker after timeout');
        throw new Error('Force research worker shutdown due to timeout');
      }, 15000);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('Research worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down research worker:', error);
    throw new Error('Error shutting down research worker');
  }
};

export const startResearchWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info(
      'Redis not available — skipping research queue/worker startup.'
    );
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping research worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('Research worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<ResearchJobData>(
    'research-jobs',
    async (job) => {
      const {
        agentId,
        jobId,
        userId,
        dateStart,
        dateEnd,
        model,
        categories,
        institutions,
        searchHash,
      } = job.data;

      const activeJobKey = searchHash ? generateActiveJobKey(searchHash) : null;

      try {
        await storage.hset(`research-job:${jobId}`, {
          status: 'processing',
          progress: 'Initializing research analysis...',
          last_updated: Date.now(),
        });

        const results = await performResearchAnalysis({
          agentId,
          dateStart,
          dateEnd,
          model,
          categories,
          institutions,
          userId,
          limiter: sharedLimiter,
          onProgress: async (message: string) => {
            await storage.hset(`research-job:${jobId}`, {
              progress: message,
              last_updated: Date.now(),
            });
          },
        });

        const resultsJson = JSON.stringify(results);

        await storage.hset(`research-job:${jobId}`, {
          status: 'completed',
          results: resultsJson,
          progress: 'Research analysis complete!',
          completed: Date.now(),
        });

        // Cache the results and clean up active job marker
        if (searchHash) {
          const cacheKey = generateCacheKey(searchHash);
          await Promise.all([
            storage.setex(cacheKey, CACHE_TTL, resultsJson),
            activeJobKey ? storage.del(activeJobKey) : Promise.resolve(),
          ]);
          logger.debug(`Cached results and cleaned up active job for search hash: ${searchHash}`);
        }

        return results;
      } catch (error) {
        await storage.hset(`research-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
        });

        // Clean up active job key on error
        if (activeJobKey) {
          await storage.del(activeJobKey);
          logger.info(`Cleaned up active job marker due to error for job: ${jobId}`);
        }

        throw error;
      }
    },
    {
      connection,
      lockDuration: 600000,
      concurrency: 2,
      limiter: {
        max: 2,
        duration: 5000,
      },
      stalledInterval: 180000,
      maxStalledCount: 2,
    }
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
