import { Worker } from 'bullmq';
import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { CertaJobData } from './queue';
import { QueryEngineManager } from '@/features/ai-agents/utils/certa/queryEngineManager';
import { PuppeteerCrawlerFactory } from '@/features/ai-agents/utils/crawler';
import { PromptManager } from '@/features/ai-agents/utils/certa/promptManager';
import { ComplianceChecker } from '@/features/ai-agents/utils/certa/complianceChecker';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { AiFactoryEmbeddingsAdapter } from '@/features/ai-agents/utils/aiFactoryEmbeddingsAdapter';
import { AIFactory } from '@/features/ai-provider/factory';
import { getRedisClient } from '@/server/storage/redisConnection';
import { DEFAULT_WORKER_CONFIG, WORKER_SHUTDOWN_TIMEOUT } from '@/features/ai-agents/utils/shared/types';

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down CERTA worker...`);

  try {
    await storage.del('worker:certa:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down CERTA worker after timeout');
        throw new Error('Force CERTA worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);

      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('CERTA worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down CERTA worker:', error);
    throw error;
  }
};

export const startCertaWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping CERTA worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping CERTA worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('CERTA worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<CertaJobData>(
    'certa-jobs',
    async (job) => {
      const { jobId, url, model, policies, instructions, userId } = job.data;

      let factory: PuppeteerCrawlerFactory | undefined;

      try {
        const ai = new AIFactory({ userId });

        // 1) Build AI sources using passed context
        const complianceAi = await ai.buildUserSource(model);
        const embeddingsAi = await ai.buildEmbeddingSource();

        // 2) Create adapters
        const completionAdapter = new AiFactoryCompletionAdapter(complianceAi);
        const embeddingsAdapter = new AiFactoryEmbeddingsAdapter(embeddingsAi);

        // 3) Create new QueryEngineManager instance for each job
        const queryEngine = new QueryEngineManager(
          completionAdapter,
          embeddingsAdapter
        );

        // 4) Always crawl URL for fresh data
        factory = new PuppeteerCrawlerFactory(new URL(url), ['nav', 'footer']);

        logger.info(`Crawling URL: ${url}`);
        await factory.crawler.run([url]);

        logger.info(`Crawled URL: ${url}, found ${factory.documents.length} documents`);

        if (!factory.documents || factory.documents.length === 0) {
          logger.error('No documents found during crawling');
          throw new Error('No documents found during crawling');
        }
        await queryEngine.addDocuments(factory.documents);
        logger.info(`Added ${factory.documents.length} documents to query engine`);
        await factory.crawler.teardown();

        const pendingPolicies = policies.map((pol) => ({
          title: pol.title,
          promise: (async () => {
            const prompts = new PromptManager(
              complianceAi,
              pol.content,
              instructions,
              pol.requirements
            );
            const checker = new ComplianceChecker(prompts, queryEngine);
            return {
              title: pol.title,
              result: await checker.checkSinglePolicy(pol.title),
            };
          })(),
        }));

        const results: Record<string, any> = {};
        const remaining = [...pendingPolicies];

        // Process results as they complete
        while (remaining.length > 0) {
          const completed = await Promise.race(remaining.map((p) => p.promise));

          results[completed.title] = completed.result;

          // Store partial results
          await storage.hset(`certa-job:${jobId}`, {
            partialResults: JSON.stringify(results),
            last_updated: Date.now(),
          });

          // Remove completed policy from remaining
          const index = remaining.findIndex((p) => p.title === completed.title);
          remaining.splice(index, 1);
        }

        // Store final results
        await storage.hset(`certa-job:${jobId}`, {
          status: 'completed',
          results: JSON.stringify(results),
          completed: Date.now(),
        });

        return results;
      } catch (error) {
        await storage.hset(`certa-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
        });
        await factory?.crawler.teardown();
        throw error;
      }
    },
    {
      connection,
      lockDuration: 60000, // 1 minute (CERTA needs shorter due to crawler)
      concurrency: 1, // CERTA runs one at a time due to browser automation
      limiter: {
        max: 1,
        duration: 1000,
      },
      stalledInterval: DEFAULT_WORKER_CONFIG.stalledInterval,
      maxStalledCount: DEFAULT_WORKER_CONFIG.maxStalledCount,
    }
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
