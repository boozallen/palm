import { Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import db from '@/server/db';
import { GraphCopyJobData } from './queue';
import { getRedisClient } from '@/server/storage/redisConnection';
import {
  DEFAULT_WORKER_CONFIG,
  WORKER_SHUTDOWN_TIMEOUT,
} from '@/features/ai-agents/utils/shared/types';
import copyGraphData from '@/features/shared/dal/document-library/upload/copyGraphData';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { reportJobFailure } from '@/server/reportJobFailure';

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down Graph Copy worker...`);

  try {
    await storage.del('worker:graph-copy:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down Graph Copy worker after timeout');
        throw new Error('Force Graph Copy worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('Graph Copy worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down Graph Copy worker:', error);
    throw error;
  }
};

export const startGraphCopyWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping Graph Copy queue/worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping Graph Copy worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('Graph Copy worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<GraphCopyJobData>(
    'graph-copy-jobs',
    async (job) => {
      const { jobId, userId, sourceDocumentId, targetDocumentId, filename } = job.data;

      try {
        await storage.hset(`graph-copy-job:${jobId}`, {
          status: 'processing',
          progress: 'Starting graph data copy...',
          created: Date.now(),
          last_updated: Date.now(),
        });

        logger.info('Starting graph copy', {
          jobId,
          sourceDocumentId,
          targetDocumentId,
          filename,
        });

        // Step 1: Create graph_metadata with Building status (so UI shows "being graphed")
        const graphId = `graph_${randomUUID()}`;

        await storage.hset(`graph-copy-job:${jobId}`, {
          progress: 'Initializing graph copy...',
          last_updated: Date.now(),
        });

        await db.graphMetadata.create({
          data: {
            graphId,
            userId,
            documentIds: [targetDocumentId],
            status: GraphBuildStatus.Building,
            buildProgress: {
              currentStep: 'Copying graph data...',
            },
          },
        });

        logger.info(`Created graph_metadata with Building status for document ${targetDocumentId}`);

        // Step 2: Copy Neo4j graph data
        await storage.hset(`graph-copy-job:${jobId}`, {
          progress: 'Copying graph nodes and relationships...',
          last_updated: Date.now(),
        });

        const graphCopied = await copyGraphData({
          sourceDocumentId,
          targetDocumentId,
          targetUserId: userId,
        });

        logger.info('Graph copy complete', {
          jobId,
          sourceDocumentId,
          targetDocumentId,
          graphCopied,
        });

        // Step 3: Update graph_metadata to Completed status
        if (graphCopied) {
          await storage.hset(`graph-copy-job:${jobId}`, {
            progress: 'Finalizing graph metadata...',
            last_updated: Date.now(),
          });

          await db.graphMetadata.update({
            where: { graphId },
            data: {
              status: GraphBuildStatus.Completed,
              completedAt: new Date(),
              buildProgress: Prisma.JsonNull,
            },
          });

          logger.info(`Updated graph_metadata to Completed status for document ${targetDocumentId}`);

          // TODO: Implement cross-document entity resolution
          // When a user accepts a shared document with graph data, we should resolve
          // duplicate entities/concepts with their existing documents.
          // This would involve:
          // 1. Getting user's existing graphed document IDs
          // 2. Running incremental entity resolution (similar to graph build worker)
          // 3. Running resolution in background without blocking job completion
          //
          // For now, users can trigger a graph rebuild to get cross-document resolution.
          //
          // const existingGraphs = await db.graphMetadata.findMany({
          //   where: {
          //     userId,
          //     status: GraphBuildStatus.Completed,
          //     documentIds: { isEmpty: false },
          //   },
          //   select: { documentIds: true },
          // });
          // const existingDocIds = new Set<string>();
          // for (const graph of existingGraphs) {
          //   for (const docId of graph.documentIds) {
          //     if (docId !== targetDocumentId) {
          //       existingDocIds.add(docId);
          //     }
          //   }
          // }
          // // Call entity resolution here with [targetDocumentId] as new docs
          // // and Array.from(existingDocIds) as existing docs
        } else {
          // No graph data to copy - delete the Building metadata record
          await db.graphMetadata.delete({
            where: { graphId },
          });
          logger.info(`Deleted graph_metadata (no graph data to copy) for document ${targetDocumentId}`);
        }

        await storage.hset(`graph-copy-job:${jobId}`, {
          status: 'completed',
          progress: graphCopied ? 'Graph data copied successfully!' : 'No graph data to copy.',
          results: JSON.stringify({
            graphCopied,
            filename,
            sourceDocumentId,
            targetDocumentId,
          }),
          completed: Date.now(),
          last_updated: Date.now(),
        });

        return {
          graphCopied,
          filename,
        };
      } catch (error) {
        logger.error('Error in Graph Copy worker:', error);

        await storage.hset(`graph-copy-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
          last_updated: Date.now(),
        });

        // Update graph_metadata to Failed status if it was created
        try {
          const graphMetadata = await db.graphMetadata.findFirst({
            where: {
              userId,
              documentIds: { has: targetDocumentId },
              status: GraphBuildStatus.Building,
            },
          });

          if (graphMetadata) {
            await db.graphMetadata.update({
              where: { graphId: graphMetadata.graphId },
              data: {
                status: GraphBuildStatus.Failed,
                buildProgress: Prisma.JsonNull,
              },
            });
            logger.info(`Updated graph_metadata to Failed status for document ${targetDocumentId}`);
          }
        } catch (metadataError) {
          logger.error('Error updating graph_metadata to Failed status:', metadataError);
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
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`[GRAPH-COPY] Job ${job?.id} failed:`, err);
    reportJobFailure(job, err);
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
};
