import { Worker } from 'bullmq';

import { syncConversationGraph } from '@/features/graph-database/services/syncConversationGraph';
import type { ConversationGraphSyncJobData } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import { logger } from '@/server/logger';
import { getRedisClient } from '@/server/storage/redisConnection';
import { reportJobFailure } from '@/server/reportJobFailure';

let worker: Worker<ConversationGraphSyncJobData> | null = null;
let workerStarted = false;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;

  logger.info(`Conversation graph worker received ${signal}, shutting down`);
  try {
    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down conversation graph worker after timeout');
        process.exit(1);
      }, 15000);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      worker = null;
      workerStarted = false;
    }
  } catch (error) {
    logger.error('Error shutting down conversation graph worker', { error });
    throw error;
  } finally {
    shutdownInProgress = false;
  }
};

export const startConversationGraphWorker = async (): Promise<void> => {
  // No flag/toggle check here: this only decides whether the queue processor
  // exists. Gating "on" at boot time would mean flipping the admin Memory
  // toggle on later requires a container restart to take effect. The actual
  // enable/disable check happens per-enqueue (conversationGraphQueue.ts) and
  // per-job below, both of which read the toggle live.
  if (workerStarted && worker?.isRunning()) {
    return;
  }

  let connection;
  try {
    connection = getRedisClient();
  } catch (error) {
    logger.warn('Redis not available — skipping conversation graph worker startup', { error });
    return;
  }

  if (worker) {
    await worker.close();
  }

  worker = new Worker<ConversationGraphSyncJobData>(
    'conversation-graph',
    async (job) => {
      if (!(await isMemoryEnabled())) {
        return;
      }
      if (job.name === 'sync') {
        await syncConversationGraph(job.data);
        return;
      }

      throw new Error('Unsupported conversation graph job');
    },
    {
      connection,
      concurrency: 1,
    },
  );
  workerStarted = true;

  worker.on('completed', (job) => {
    logger.info('Conversation graph job completed', { jobId: job.id });
  });
  worker.on('failed', (job, error) => {
    logger.error('Conversation graph job failed', {
      jobId: job?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    reportJobFailure(job, error);
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  logger.info('Conversation graph worker started successfully');
};
