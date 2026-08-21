import db from '@/server/db';
import logger from '@/server/logger';

export default async function getPrismJobs(aiAgentId: string, userId: string) {
  try {
    return await db.agentPrismJob.findMany({
      where: { aiAgentId, userId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error fetching PRISM jobs: ', error);
    throw new Error('Error fetching PRISM jobs');
  }
}
