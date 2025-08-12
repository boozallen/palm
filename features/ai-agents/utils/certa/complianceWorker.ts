import { Worker } from 'bullmq';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { ComplianceJobData } from '@/features/ai-agents/utils/certa/complianceQueue';
import { QueryEngineManager } from '@/features/ai-agents/utils/certa/queryEngineManager';
import { PuppeteerCrawlerFactory } from '@/features/ai-agents/utils/crawler';
import { PromptManager } from '@/features/ai-agents/utils/certa/promptManager';
import { ComplianceChecker } from '@/features/ai-agents/utils/certa/complianceChecker';
import getUserFirstAvailableOpenAiModel from '@/features/shared/dal/getUserFirstAvailableOpenAiModel';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { AiFactoryEmbeddingsAdapter } from '@/features/ai-agents/utils/aiFactoryEmbeddingsAdapter';
import { AIFactory } from '@/features/ai-provider/factory';
import { getRedisClient } from '@/server/storage/redisConnection';
import { BadRequest } from '@/features/shared/errors/routeErrors';

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down worker...`);

  try {
    await storage.del('worker:compliance:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down worker after timeout');
        throw new Error('Force worker shutdown due to timeout');
      }, 10000);

      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('Worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down worker:', error);
    throw new Error('Error shutting down worker');
  }
};

export const startWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping queue/worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('Worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<ComplianceJobData>(
    'compliance-checks',
    async (job) => {
      const { jobId, url, model, policies, instructions, userId } = job.data;

      let factory: PuppeteerCrawlerFactory | undefined;

      try {
        // 1) Get OpenAI model
        const openAiModel = await getUserFirstAvailableOpenAiModel(userId);

        if (!openAiModel) {
          throw BadRequest('This agent requires access to an Open AI model. Please reach out to your group lead or manager to get access');
        }

        const ai = new AIFactory({ userId });

        // 2) Build AI sources using passed context
        const complianceAi = await ai.buildUserSource(model);
        const embeddingsAi = await ai.buildUserSource(openAiModel.id);

        // 3) Create adapters
        const completionAdapter = new AiFactoryCompletionAdapter(complianceAi);
        const embeddingsAdapter = new AiFactoryEmbeddingsAdapter(embeddingsAi);

        // 4) Create new QueryEngineManager instance for each job
        const queryEngine = new QueryEngineManager(
          completionAdapter,
          embeddingsAdapter
        );

        // 5) Always crawl URL for fresh data
        factory = new PuppeteerCrawlerFactory(new URL(url), ['nav', 'footer']);

        logger.info(`Crawling URL: ${url}`);
        await factory.crawler.run([url]);

        logger.info(`Crawled URL: ${url}, found ${factory.documents.length} documents`);

        if (!factory.documents || factory.documents.length === 0) {
          logger.error('No documents found during crawling');
          throw new Error();
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
          await storage.hset(`job:${jobId}`, {
            partialResults: JSON.stringify(results),
            last_updated: Date.now(),
          });

          // Remove completed policy from remaining
          const index = remaining.findIndex((p) => p.title === completed.title);
          remaining.splice(index, 1);
        }

        // Store final results
        await storage.hset(`job:${jobId}`, {
          results: JSON.stringify(results),
          completed: Date.now(),
        });

        return results;
      } catch (error) {
        await storage.hset(`job:${jobId}`, {
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
      lockDuration: 60000,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 1000,
      },
      stalledInterval: 60000,
      maxStalledCount: 2,
    }
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
