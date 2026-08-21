import db from '@/server/db';
import logger from '@/server/logger';

type AgentProviderListItem = {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function getUserGroupAgentProviders(
  userGroupId: string,
): Promise<AgentProviderListItem[]> {
  try {
    const userGroup = await db.userGroup.findUnique({
      where: { id: userGroupId },
      include: {
        agentProviders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!userGroup) {
      throw new Error('User group not found');
    }

    return userGroup.agentProviders.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  } catch (error) {
    logger.error('Error fetching user group agent providers', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error fetching user group agent providers');
  }
}
