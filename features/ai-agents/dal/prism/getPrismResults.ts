import db from '@/server/db';
import logger from '@/server/logger';

export default async function getPrismResults(jobId: string) {
  try {
    return await db.agentPrismResult.findMany({
      where: { jobId },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
  } catch (error) {
    logger.error('Error fetching PRISM results: ', error);
    throw new Error('Error fetching PRISM results');
  }
}
