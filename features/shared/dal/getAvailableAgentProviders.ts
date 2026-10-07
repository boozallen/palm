import db from '@/server/db';
import logger from '@/server/logger';

export type AvailableAgentProvider = {
  id: string;
  name: string;
  description: string;
};

export default async function getAvailableAgentProviders(
  userId: string,
): Promise<AvailableAgentProvider[]> {
  try {
    const providers = await db.agentProvider.findMany({
      where: {
        deletedAt: null,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: { userId },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    }));
  } catch (error) {
    logger.error('Error fetching available agent providers', error);
    throw new Error('Error fetching available agent providers');
  }
}
