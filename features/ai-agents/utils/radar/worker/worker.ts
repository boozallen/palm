import { Worker } from 'bullmq';
import Bottleneck from 'bottleneck';
import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { RadarJobData } from './queue';
import { performResearchAnalysis } from '@/features/ai-agents/utils/radar/researchAnalysis';
import { getRedisClient } from '@/server/storage/redisConnection';
import {
  generateCacheKey,
  generateActiveJobKey,
} from '@/features/ai-agents/utils/radar/searchHash';
import { DEFAULT_WORKER_CONFIG, WORKER_SHUTDOWN_TIMEOUT } from '@/features/ai-agents/utils/shared/types';

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
  logger.info(`${signal} received, shutting down RADAR worker...`);

  try {
    await storage.del('worker:radar:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down RADAR worker after timeout');
        throw new Error('Force RADAR worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);

      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('RADAR worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down RADAR worker:', error);
    throw error;
  }
};

export const startRadarWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping RADAR worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping RADAR worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('RADAR worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<RadarJobData>(
    'radar-jobs',
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
        await storage.hset(`radar-job:${jobId}`, {
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
            await storage.hset(`radar-job:${jobId}`, {
              progress: message,
              last_updated: Date.now(),
            });
          },
        });

        const resultsJson = JSON.stringify(results);

        await storage.hset(`radar-job:${jobId}`, {
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
        await storage.hset(`radar-job:${jobId}`, {
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
      ...DEFAULT_WORKER_CONFIG,
    }
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
