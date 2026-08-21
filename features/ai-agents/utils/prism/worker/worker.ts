import { Worker } from 'bullmq';
import cosineSimilarity from 'compute-cosine-similarity';
import { z } from 'zod';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { PrismJobData } from './queue';
import { getRedisClient } from '@/server/storage/redisConnection';
import {
  DEFAULT_WORKER_CONFIG,
  WORKER_SHUTDOWN_TIMEOUT,
} from '@/features/ai-agents/utils/shared/types';
import { AIFactory } from '@/features/ai-provider/factory';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { AiFactoryEmbeddingsAdapter } from '@/features/ai-agents/utils/aiFactoryEmbeddingsAdapter';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { chunkText } from '@/features/document-upload-provider/sources/utils/chunkText';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
import { parseRequirementsSpreadsheet } from '@/features/ai-agents/utils/prism/parseRequirementsSpreadsheet';
import { prompts as prismPrompts } from '@/features/ai-agents/data/prism/prompts';
import { getPromptById, insertRequestValuesIntoPrompt } from '@/features/shared/utils/prompt-helpers';
import { ComplianceStatus } from '@/features/ai-agents/types/prism/complianceResult';
import type { ParsedRequirement } from '@/features/ai-agents/types/prism/complianceResult';
import updatePrismJobStatus from '@/features/ai-agents/dal/prism/updatePrismJobStatus';
import savePrismResult from '@/features/ai-agents/dal/prism/savePrismResult';

const CONTEXT_CHUNK_COUNT = 10;
const CHUNK_BATCH_SIZE = 20;
const MAX_EMBEDDING_CHARS = 40000;
const REQUIREMENTS_BATCH_SIZE = 20;

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const resultItemSchema = z.object({
  requirement: z.string(),
  complianceStatus: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.nativeEnum(ComplianceStatus),
  ),
  reasoning: z.string(),
  citations: z.string().nullable().optional().transform((v) => v ?? null),
});

const resultSchema = z.array(resultItemSchema);

type EmbeddedChunk = {
  text: string;
  embedding: number[];
};

function findTopKChunks(
  chunks: EmbeddedChunk[],
  queryEmbedding: number[],
  k: number,
): EmbeddedChunk[] {
  return chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding) ?? 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.chunk);
}

function groupRequirementsByCategory(
  requirements: ParsedRequirement[],
): Map<string, ParsedRequirement[]> {
  const groups = new Map<string, ParsedRequirement[]>();

  for (const req of requirements) {
    const key = req.category ?? '__uncategorized__';
    const existing = groups.get(key);
    if (existing) {
      existing.push(req);
    } else {
      groups.set(key, [req]);
    }
  }

  return groups;
}

async function embedInBatches(
  texts: string[],
  embeddingsAdapter: AiFactoryEmbeddingsAdapter,
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += CHUNK_BATCH_SIZE) {
    const batch = texts.slice(i, i + CHUNK_BATCH_SIZE);
    const batchEmbeddings = await embeddingsAdapter.getEmbeddings(batch);
    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down PRISM worker...`);

  try {
    await storage.del('worker:prism:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down PRISM worker after timeout');
        throw new Error('Force PRISM worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('PRISM worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down PRISM worker:', error);
    throw error;
  }
};

export const startPrismWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping PRISM queue/worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping PRISM worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('PRISM worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<PrismJobData>(
    'prism-jobs',
    async (job) => {
      const {
        jobId,
        userId,
        agentId,
        requirementsFileKey,
        requirementsFilename,
        proposalFileKey,
        proposalFilename,
        proposalContentType,
        documentUploadProviderId,
        modelId,
      } = job.data;

      const storageProvider = await (async () => {
        const factory = new DocumentUploadFactory({ userId });
        const { source } = await factory.buildSource(documentUploadProviderId);
        return source;
      })();

      try {
        await storage.hset(`prism-job:${jobId}`, {
          status: 'processing',
          progress: 'Starting proposal analysis...',
          last_updated: Date.now(),
        });
        await updatePrismJobStatus(jobId, 'processing');

        logger.info('Starting PRISM proposal analysis', {
          jobId,
          agentId,
          modelId,
          proposalFilename,
          requirementsFilename,
        });

        // Step 1: Fetch files from S3
        await storage.hset(`prism-job:${jobId}`, {
          progress: 'Fetching uploaded files...',
          last_updated: Date.now(),
        });

        const [requirementsBuffer, proposalBuffer] = await Promise.all([
          storageProvider.fetchFile(requirementsFileKey),
          storageProvider.fetchFile(proposalFileKey),
        ]);

        // Step 2: Parse files
        await storage.hset(`prism-job:${jobId}`, {
          progress: 'Parsing documents...',
          last_updated: Date.now(),
        });

        const [requirements, proposalText] = await Promise.all([
          parseRequirementsSpreadsheet(requirementsBuffer),
          parseFile(proposalBuffer, proposalContentType),
        ]);

        if (requirements.length === 0) {
          throw new Error('No requirements found in the spreadsheet. Please ensure column F contains requirement text.');
        }

        if (!proposalText || proposalText.trim().length === 0) {
          throw new Error('No text could be extracted from the proposal document.');
        }

        logger.info('Files parsed', {
          jobId,
          requirementCount: requirements.length,
          proposalTextLength: proposalText.length,
        });

        // Step 3: Clean up S3 files now that we have the content
        await Promise.all([
          storageProvider.deleteFile(requirementsFileKey),
          storageProvider.deleteFile(proposalFileKey),
        ]);

        // Step 4: Initialise AI models
        await storage.hset(`prism-job:${jobId}`, {
          progress: 'Initializing AI models...',
          last_updated: Date.now(),
        });

        const ai = new AIFactory({ userId });
        const completionSource = await ai.buildUserSource(modelId);
        const embeddingSource = await ai.buildEmbeddingSource();
        const completionAdapter = new AiFactoryCompletionAdapter(completionSource);
        const embeddingsAdapter = new AiFactoryEmbeddingsAdapter(embeddingSource);

        // Step 5: Chunk and embed the proposal
        await storage.hset(`prism-job:${jobId}`, {
          progress: 'Processing proposal document...',
          last_updated: Date.now(),
        });

        const chunks = await chunkText({ text: proposalText });

        await storage.hset(`prism-job:${jobId}`, {
          progress: `Embedding ${chunks.length} proposal sections...`,
          last_updated: Date.now(),
        });

        const chunkEmbeddings = await embedInBatches(
          chunks.map((c) => c.content),
          embeddingsAdapter,
        );

        const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, i) => ({
          text: chunk.content,
          embedding: chunkEmbeddings[i],
        }));

        // Step 6: Analyse each category batch
        const groups = groupRequirementsByCategory(requirements);
        const categoryKeys = Array.from(groups.keys());
        let globalSortOrder = 0;
        let categoriesProcessed = 0;

        const analysisPrompt = getPromptById(prismPrompts, 'proposal-analysis');

        for (const categoryKey of categoryKeys) {
          const categoryRequirements = groups.get(categoryKey)!;
          const displayCategory = categoryKey === '__uncategorized__' ? null : categoryKey;

          categoriesProcessed++;

          const batches: ParsedRequirement[][] = [];
          for (let i = 0; i < categoryRequirements.length; i += REQUIREMENTS_BATCH_SIZE) {
            batches.push(categoryRequirements.slice(i, i + REQUIREMENTS_BATCH_SIZE));
          }

          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const reqStart = batchIndex * REQUIREMENTS_BATCH_SIZE + 1;
            const reqEnd = Math.min((batchIndex + 1) * REQUIREMENTS_BATCH_SIZE, categoryRequirements.length);

            await storage.hset(`prism-job:${jobId}`, {
              progress: `Analyzing ${displayCategory ?? 'requirements'} — ${reqStart}–${reqEnd} of ${categoryRequirements.length}...`,
              last_updated: Date.now(),
            });

            const queryText = batch.map((r) => r.requirement).join(' ');
            const truncatedQueryText = queryText.length > MAX_EMBEDDING_CHARS ? queryText.slice(0, MAX_EMBEDDING_CHARS) : queryText;
            const [queryEmbedding] = await embeddingsAdapter.getEmbeddings([truncatedQueryText]);
            const relevantChunks = findTopKChunks(embeddedChunks, queryEmbedding, CONTEXT_CHUNK_COUNT);
            const proposalContext = relevantChunks.map((c) => c.text).join('\n\n---\n\n');

            const numberedRequirements = batch
              .map((r, i) => `${i + 1}. ${r.requirement}`)
              .join('\n');

            const filledPrompt = insertRequestValuesIntoPrompt(
              { proposalContext, requirements: numberedRequirements },
              analysisPrompt.instructions,
            );

            let parsedResults: z.infer<typeof resultSchema> | null = null;
            let attempts = 0;

            while (parsedResults === null && attempts < 2) {
              attempts++;
              try {
                const response = await completionAdapter.complete({ prompt: filledPrompt });
                const raw = response.text;
                const start = raw.indexOf('[');
                const end = raw.lastIndexOf(']');
                if (start === -1 || end === -1 || end <= start) {
                  throw new Error('No JSON array found in response');
                }
                const json = JSON.parse(raw.slice(start, end + 1));
                const parsed = resultSchema.safeParse(json);
                if (parsed.success) {
                  parsedResults = parsed.data;
                } else {
                  logger.warn('Zod validation failed for PRISM batch', {
                    jobId,
                    category: displayCategory,
                    batchIndex,
                    attempt: attempts,
                    error: parsed.error.message,
                  });
                }
              } catch (e) {
                logger.warn('JSON parse failed for PRISM batch', {
                  jobId,
                  category: displayCategory,
                  batchIndex,
                  attempt: attempts,
                  error: (e as Error).message,
                });
              }
            }

            for (let i = 0; i < batch.length; i++) {
              const req = batch[i];
              const result = parsedResults?.[i];

              await savePrismResult({
                jobId,
                category: displayCategory,
                requirement: req.requirement,
                complianceStatus: result?.complianceStatus ?? ComplianceStatus.NEEDS_REVIEW,
                reasoning: result?.reasoning ?? 'Analysis could not be completed for this requirement.',
                citations: result?.citations ?? null,
                sortOrder: globalSortOrder,
              });

              globalSortOrder++;
            }
          }
        }

        await storage.hset(`prism-job:${jobId}`, {
          status: 'completed',
          progress: 'Analysis complete!',
          completed: Date.now(),
          last_updated: Date.now(),
        });
        await updatePrismJobStatus(jobId, 'completed');

        logger.info('PRISM analysis complete', { jobId, totalResults: globalSortOrder });

        return { jobId };
      } catch (error) {
        logger.error('Error in PRISM worker:', error);

        await storage.hset(`prism-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
          last_updated: Date.now(),
        });

        try {
          await updatePrismJobStatus(jobId, 'error');
        } catch (dbError) {
          logger.error('Failed to update PRISM job status in DB after error:', dbError);
        }

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
    },
  );

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
