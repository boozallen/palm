import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateOdramJobStatus(jobId: string, status: string): Promise<void> {
  try {
    await db.agentOdramJob.update({
      where: { id: jobId },
      data: { status },
    });
  } catch (error) {
    logger.error('Error updating ODRAM job status: ', error);
    throw new Error('Error updating ODRAM job status');
  }
}
