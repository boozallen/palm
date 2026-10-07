import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateOdramJobSummary(jobId: string, summary: string): Promise<void> {
  try {
    await db.agentOdramJob.update({
      where: { id: jobId },
      data: { summary },
    });
  } catch (error) {
    logger.error('Error updating ODRAM job summary: ', error);
    throw new Error('Error updating ODRAM job summary');
  }
}
