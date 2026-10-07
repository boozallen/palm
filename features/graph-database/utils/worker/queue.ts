import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';

export type GraphBuildJobData = {
  graphId: string;
  userId: string;
  documentIds: string[];
  /** Subset of `documentIds` that still needs extraction; the rest are already
   * extracted and are only being (re-)resolved, so the worker must not re-extract
   * them. Empty array = a resolution-only run. */
  extractDocumentIds: string[];
  jobId: string;
  isIncremental: boolean;
  existingDocumentIds: string[];
  // Selected extraction schema (CUSTOM_GRAPH_SCHEMA). Undefined → worker resolves
  // to the default `general` schema (or legacy path when the flag is off).
  schemaKey?: string;
  // Per-document schema overrides. An entry for a document id wins over the
  // batch-default `schemaKey`; documents without an entry fall back to `schemaKey`.
  schemaKeysByDocumentId?: Record<string, string>;
};

let graphBuildQueue: Queue<GraphBuildJobData> | null = null;

export const getGraphBuildQueue = (): Queue<GraphBuildJobData> | null => {
  if (graphBuildQueue) {
    return graphBuildQueue;
  }

  try {
    const connection = getRedisClient();
    graphBuildQueue = new Queue<GraphBuildJobData>('graph-build-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 2, // Only retry once - graph builds are expensive
        backoff: {
          type: 'exponential',
          delay: 30000, // 30s delay before retry
        },
      },
    });

    logger.info('Graph build queue initialized successfully');
    return graphBuildQueue;
  } catch (error) {
    logger.error('Could not initialize graph build queue:', error);
    return null;
  }
};
