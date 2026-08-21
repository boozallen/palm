import db from '@/server/db';
import logger from '@/server/logger';

export default async function updatePrismJobStatus(jobId: string, status: string): Promise<void> {
  try {
    await db.agentPrismJob.update({
      where: { id: jobId },
      data: { status },
    });
  } catch (error) {
    logger.error('Error updating PRISM job status: ', error);
    throw new Error('Error updating PRISM job status');
  }
}
