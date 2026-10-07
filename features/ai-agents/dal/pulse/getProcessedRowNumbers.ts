import db from '@/server/db';
import logger from '@/server/logger';

// Lets a retried job resume instead of re-billing rows it already derived.
export default async function getProcessedRowNumbers(jobId: string): Promise<number[]> {
  try {
    const rows = await db.agentPulseResult.findMany({
      where: { jobId },
      select: { rowNumber: true },
    });

    return rows.map((row) => row.rowNumber);
  } catch (error) {
    logger.error('Failed to load processed PULSE rows', {
      jobId,
      error: (error as Error).message,
    });
    throw new Error('Failed to load processed PULSE rows');
  }
}
