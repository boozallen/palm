import db from '@/server/db';
import logger from '@/server/logger';

type CreateOdramJobParams = {
  id: string;
  aiAgentId: string;
  userId: string;
  odramFilename: string;
  userGroupId: string | null;
};

export default async function createOdramJob(params: CreateOdramJobParams): Promise<void> {
  try {
    await db.agentOdramJob.create({
      data: {
        id: params.id,
        aiAgentId: params.aiAgentId,
        userId: params.userId,
        status: 'queued',
        odramFilename: params.odramFilename,
        userGroupId: params.userGroupId,
      },
    });
  } catch (error) {
    logger.error('Error creating ODRAM job: ', error);
    throw new Error('Error creating ODRAM job');
  }
}
