import db from '@/server/db';
import logger from '@/server/logger';

export default async function getActiveOdramJob(aiAgentId: string, userId: string) {
  try {
    return await db.agentOdramJob.findFirst({
      where: {
        aiAgentId,
        userId,
        status: { in: ['queued', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error fetching active ODRAM job: ', error);
    throw new Error('Error fetching active ODRAM job');
  }
}
