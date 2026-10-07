import db from '@/server/db';
import logger from '@/server/logger';

export default async function getActivePrismJob(aiAgentId: string, userId: string) {
  try {
    return await db.agentPrismJob.findFirst({
      where: {
        aiAgentId,
        userId,
        status: { in: ['queued', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error fetching active PRISM job: ', error);
    throw new Error('Error fetching active PRISM job');
  }
}
