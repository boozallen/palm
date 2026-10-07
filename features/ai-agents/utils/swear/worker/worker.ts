import { Worker } from 'bullmq';
import { z } from 'zod';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { SwearJobData } from './queue';
import { getRedisClient } from '@/server/storage/redisConnection';
import {
  DEFAULT_WORKER_CONFIG,
  WORKER_SHUTDOWN_TIMEOUT,
} from '@/features/ai-agents/utils/shared/types';
import { AIFactory } from '@/features/ai-provider/factory';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import getChecklistItems, { formatChecklistForPrompt } from '@/features/ai-agents/dal/swear/getChecklistItems';
import { prompts as swearPrompts } from '@/features/ai-agents/data/swear/prompts';
import { reportJobFailure } from '@/server/reportJobFailure';
import { getPromptById, insertRequestValuesIntoPrompt } from '@/features/shared/utils/prompt-helpers';
import { AnalysisStatus, AnalysisConfidence } from '@/features/ai-agents/types/swear/analysisItem';

const analysisItemSchema = z.object({
  category: z.string(),
  requirement: z.string(),
  status: z.nativeEnum(AnalysisStatus),
  confidence: z.nativeEnum(AnalysisConfidence),
  evidence: z.string(),
});

const analysisResultSchema = z.array(analysisItemSchema);

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down SWEAR worker...`);

  try {
    await storage.del('worker:swear:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down SWEAR worker after timeout');
        throw new Error('Force SWEAR worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('SWEAR worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down SWEAR worker:', error);
    throw error;
  }
};

export const startSwearWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping SWEAR queue/worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping SWEAR worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('SWEAR worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<SwearJobData>(
    'swear-jobs',
    async (job) => {
      const { jobId, documentText, userId, modelId, agentId, filename, userGroupId } = job.data;

      try {
        await storage.hset(`swear-job:${jobId}`, {
          status: 'processing',
          progress: 'Starting warrant analysis...',
          created: Date.now(),
          last_updated: Date.now(),
        });

        logger.info('Starting SWEAR warrant analysis', {
          jobId,
          modelId,
          filename,
          textLength: documentText.length,
        });

        // Step 1: Retrieve checklist items for this agent
        await storage.hset(`swear-job:${jobId}`, {
          progress: 'Loading checklist requirements...',
          last_updated: Date.now(),
        });

        const checklistItems = await getChecklistItems(agentId);
        const formattedChecklist = formatChecklistForPrompt(checklistItems);

        logger.info('Checklist items retrieved', {
          agentId,
          itemCount: checklistItems.length,
        });

        // Step 2: Initialize AI and call LLM
        await storage.hset(`swear-job:${jobId}`, {
          progress: 'Analyzing warrant...',
          last_updated: Date.now(),
        });

        const ai = new AIFactory({ userId, userGroupId: userGroupId ?? undefined });
        const aiSource = await ai.buildUserSource(modelId);
        const completionAdapter = new AiFactoryCompletionAdapter(aiSource);

        // Get and fill prompt with document content and checklist items
        const warrantPrompt = getPromptById(swearPrompts, 'warrant-analysis');
        const filledPrompt = insertRequestValuesIntoPrompt(
          { documentContent: documentText, checklistItems: formattedChecklist },
          warrantPrompt.instructions
        );

        logger.info('Calling LLM for warrant analysis', {
          jobId,
          modelId,
          filename,
          checklistItemCount: checklistItems.length,
          promptLength: filledPrompt.length,
        });

        const response = await completionAdapter.complete({
          prompt: filledPrompt,
        });

        logger.info('Warrant analysis complete', {
          jobId,
          filename,
          analysisLength: response.text.length,
        });

        // Step 3: Store results
        let analysis = null;
        try {
          // Strip markdown code blocks if present
          const text = response.text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
          const json = JSON.parse(text);
          const parsed = analysisResultSchema.safeParse(json);
          if (parsed.success) {
            analysis = parsed.data;
          } else {
            logger.warn('Zod validation failed', { jobId, error: parsed.error.message });
          }
        } catch (e) {
          logger.warn('JSON parse failed', { jobId, error: (e as Error).message });
        }

        logger.info('Warrant analysis complete', {
          jobId,
          filename,
          parsed: analysis !== null,
          itemCount: analysis?.length ?? 0,
        });

        await storage.hset(`swear-job:${jobId}`, {
          status: 'completed',
          progress: 'Analysis complete!',
          results: JSON.stringify({
            analysis,
            filename,
          }),
          completed: Date.now(),
          last_updated: Date.now(),
        });

        return {
          analysis,
          filename,
        };
      } catch (error) {
        logger.error('Error in SWEAR worker:', error);

        await storage.hset(`swear-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
          last_updated: Date.now(),
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

  worker.on('failed', (job, err) => {
    logger.error(`[SWEAR] Job ${job?.id} failed:`, err);
    reportJobFailure(job, err);
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
