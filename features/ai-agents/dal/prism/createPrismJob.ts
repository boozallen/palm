import db from '@/server/db';
import logger from '@/server/logger';

type CreatePrismJobParams = {
  id: string;
  aiAgentId: string;
  userId: string;
  requirementsFilename: string;
  proposalFilename: string;
  userGroupId: string | null;
};

export default async function createPrismJob(params: CreatePrismJobParams): Promise<void> {
  try {
    await db.agentPrismJob.create({
      data: {
        id: params.id,
        aiAgentId: params.aiAgentId,
        userId: params.userId,
        status: 'queued',
        requirementsFilename: params.requirementsFilename,
        proposalFilename: params.proposalFilename,
        userGroupId: params.userGroupId,
      },
    });
  } catch (error) {
    logger.error('Error creating PRISM job: ', error);
    throw new Error('Error creating PRISM job');
  }
}
