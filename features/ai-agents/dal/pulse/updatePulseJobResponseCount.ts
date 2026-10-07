import db from '@/server/db';
import logger from '@/server/logger';

export default async function updatePulseJobResponseCount(
  jobId: string,
  responseCount: number,
): Promise<void> {
  try {
    await db.agentPulseJob.update({
      where: { id: jobId },
      data: { responseCount },
      select: { id: true },
    });
  } catch (error) {
    logger.error('Failed to update PULSE response count', {
      jobId,
      error: (error as Error).message,
    });
    throw new Error('Failed to update PULSE response count');
  }
}
