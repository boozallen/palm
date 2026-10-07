import db from '@/server/db';
import logger from '@/server/logger';

// Counted from the saved rows rather than tallied in the worker, so a job that was
// retried still reports every response it lost, not just the ones the last attempt ran.
export default async function countFullyDefaultedRows(jobId: string): Promise<number> {
  try {
    return await db.agentPulseResult.count({
      where: { jobId, values: { some: {}, every: { wasDefaulted: true } } },
    });
  } catch (error) {
    logger.error('Failed to count fallback-only PULSE rows', {
      jobId,
      error: (error as Error).message,
    });
    throw new Error('Failed to count fallback-only PULSE rows');
  }
}
