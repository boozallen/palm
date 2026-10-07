import db from '@/server/db';
import logger from '@/server/logger';

export default async function getOdramJobs(aiAgentId: string, userId: string) {
  try {
    return await db.agentOdramJob.findMany({
      where: { aiAgentId, userId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error fetching ODRAM jobs: ', error);
    throw new Error('Error fetching ODRAM jobs');
  }
}
