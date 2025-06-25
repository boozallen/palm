import db from '@/server/db';
import logger from '@/server/logger';
import { AiAgent } from '@/features/shared/types/ai-agent';

export default async function getAvailableAgents(
  userId: string
): Promise<AiAgent[]> {
  try {
    const results = await db.aiAgent.findMany({
      where: {
        enabled: true,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: {
                userId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        enabled: true,
      },
    });

    return results.map((result) => ({
      id: result.id,
      name: result.name,
      description: result.description,
      enabled: result.enabled,
    }));
  } catch (error) {
    logger.error('Error fetching available agents', error);
    throw new Error('Error fetching available agents');
  }
}
