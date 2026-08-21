import { Worker } from 'bullmq';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { RcastJobData } from './queue';
import { getRedisClient } from '@/server/storage/redisConnection';
import {
  DEFAULT_WORKER_CONFIG,
  WORKER_SHUTDOWN_TIMEOUT,
} from '@/features/ai-agents/utils/shared/types';
import { AIFactory } from '@/features/ai-provider/factory';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { mapLaborCategoryToSoc } from '@/features/ai-agents/utils/rcast/socMapper';
import { BlsWageData, DolWageData } from '@/features/ai-agents/shared/wage-data';
import { fetchWageData as fetchBlsWageData, fetchDolWageData } from '@/features/ai-agents/shared/wage-data/clients';
import {
  getRateCardCategoriesForProcessing,
  updateCategorySocMapping,
  getCategoriesWithSocCodes,
  updateCategoryWageData,
  updateRateCardStatus,
} from '@/features/ai-agents/dal/rcast';

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down RCAST-TWO worker...`);

  try {
    await storage.del('worker:rcast:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down RCAST-TWO worker after timeout');
        throw new Error('Force RCAST-TWO worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('RCAST-TWO worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down RCAST-TWO worker:', error);
    throw error;
  }
};

export const startRcastWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping RCAST-TWO queue/worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping RCAST-TWO worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('RCAST-TWO worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<RcastJobData>(
    'rcast-jobs',
    async (job) => {
      const { jobId, rateCardId, userId, modelId } = job.data;

      try {
        await storage.hset(`rcast-job:${jobId}`, {
          status: 'processing',
          progress: 'Initializing AI model...',
          created: Date.now(),
        });

        logger.info('Starting RCAST-TWO rate card processing', {
          jobId,
          rateCardId,
          modelId,
        });

        const ai = new AIFactory({ userId });
        const aiSource = await ai.buildUserSource(modelId);
        const completionAdapter = new AiFactoryCompletionAdapter(aiSource);

        await storage.hset(`rcast-job:${jobId}`, {
          progress: 'Fetching rate card categories...',
        });

        const categories = await getRateCardCategoriesForProcessing(rateCardId);

        logger.info(`Processing ${categories.length} rate card categories`, { rateCardId });

        await storage.hset(`rcast-job:${jobId}`, {
          progress: `Mapping 0 of ${categories.length} categories to SOC codes...`,
        });

        let processedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < categories.length; i++) {
          const category = categories[i];

          try {
            logger.info(`Processing category: ${category.laborCategoryName}`, {
              categoryId: category.id,
              experienceLevel: category.experienceLevel,
            });

            const socMapping = await mapLaborCategoryToSoc(
              completionAdapter,
              category.laborCategoryName,
              category.experienceLevel
            );

            if (socMapping) {
              await updateCategorySocMapping({
                categoryId: category.id,
                socCode: socMapping.code,
                socTitle: socMapping.title,
              });

              logger.info(`Mapped category "${category.laborCategoryName}" to SOC ${socMapping.code}`, {
                categoryId: category.id,
                socCode: socMapping.code,
                socTitle: socMapping.title,
              });
            } else {
              logger.warn(`Could not map category "${category.laborCategoryName}" to SOC code`, {
                categoryId: category.id,
              });
            }

            processedCount++;

            await storage.hset(`rcast-job:${jobId}`, {
              progress: `Mapping ${i + 1} of ${categories.length} categories to SOC codes...`,
            });
          } catch (error) {
            logger.error(`Error processing category ${category.laborCategoryName}:`, error);
            errorCount++;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        await storage.hset(`rcast-job:${jobId}`, {
          progress: 'Fetching wage data from BLS and DOL APIs...',
        });

        const categoriesWithSoc = await getCategoriesWithSocCodes(rateCardId);

        const uniqueSocCodes = [...new Set(
          categoriesWithSoc
            .map(c => c.mappedSocCode)
            .filter((code): code is string => code !== null)
        )];

        logger.info(`Fetching wage data for ${uniqueSocCodes.length} unique SOC codes`, { rateCardId });

        const blsWageCache = new Map<string, BlsWageData | null>();
        const dolWageCache = new Map<string, DolWageData | null>();

        for (let i = 0; i < uniqueSocCodes.length; i++) {
          const socCode = uniqueSocCodes[i];

          await storage.hset(`rcast-job:${jobId}`, {
            progress: `Fetching wage data ${i + 1} of ${uniqueSocCodes.length} (SOC: ${socCode})...`,
          });

          try {
            const blsData = await fetchBlsWageData(socCode);
            blsWageCache.set(socCode, blsData);

            if (blsData) {
              logger.info(`Fetched BLS wage data for ${socCode}`, {
                dataYear: blsData.dataYear,
                meanHourlyWage: blsData.meanHourlyWage,
              });
            }

            await new Promise((resolve) => setTimeout(resolve, 300));

            const dolData = await fetchDolWageData(socCode);
            dolWageCache.set(socCode, dolData);

            if (dolData) {
              logger.info(`Fetched DOL wage data for ${socCode}`, {
                dataYear: dolData.dataYear,
                hourlyMedian: dolData.hourlyMedian,
              });
            }
          } catch (error) {
            logger.error(`Error fetching wage data for ${socCode}:`, error);
            blsWageCache.set(socCode, null);
            dolWageCache.set(socCode, null);
          }

          if (i < uniqueSocCodes.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        await storage.hset(`rcast-job:${jobId}`, {
          progress: 'Saving wage data to database...',
        });

        for (const category of categoriesWithSoc) {
          if (!category.mappedSocCode) {
            continue;
          }

          const blsData = blsWageCache.get(category.mappedSocCode) ?? null;
          const dolData = dolWageCache.get(category.mappedSocCode) ?? null;

          if (blsData || dolData) {
            await updateCategoryWageData({
              categoryId: category.id,
              blsData,
              dolData,
            });

            logger.info(`Saved wage data for "${category.laborCategoryName}"`, {
              categoryId: category.id,
              hasBls: !!blsData,
              hasDol: !!dolData,
            });
          }
        }

        await storage.hset(`rcast-job:${jobId}`, {
          progress: 'Finalizing...',
        });

        logger.info('RCAST-TWO rate card processing complete', {
          rateCardId,
          processedCount,
          errorCount,
          uniqueSocCodes: uniqueSocCodes.length,
          blsDataFetched: [...blsWageCache.values()].filter(Boolean).length,
          dolDataFetched: [...dolWageCache.values()].filter(Boolean).length,
        });

        await updateRateCardStatus(rateCardId, 'completed');

        await storage.hset(`rcast-job:${jobId}`, {
          status: 'completed',
          progress: `Processing complete! Processed ${processedCount} categories${errorCount > 0 ? ` (${errorCount} errors)` : ''}.`,
          completed: Date.now(),
        });

        return { processedCount, errorCount };
      } catch (error) {
        logger.error('Error in RCAST-TWO worker:', error);

        await updateRateCardStatus(rateCardId, 'failed');

        await storage.hset(`rcast-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
        });
        throw error;
      }
    },
    {
      connection,
      lockDuration: DEFAULT_WORKER_CONFIG.lockDuration,
      concurrency: DEFAULT_WORKER_CONFIG.concurrency,
      limiter: DEFAULT_WORKER_CONFIG.limiter,
      stalledInterval: DEFAULT_WORKER_CONFIG.stalledInterval,
      maxStalledCount: DEFAULT_WORKER_CONFIG.maxStalledCount,
    }
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
