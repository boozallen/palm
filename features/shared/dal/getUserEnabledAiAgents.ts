import logger from '@/server/logger';
import db from '@/server/db';
import { AiAgent } from '@/features/shared/types/ai-agent';

export default async function getUserEnabledAiAgents(
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

    return results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
    }));
    
  } catch (error) {
    logger.error('Error fetching user enabled AI agents', error);
    throw new Error('Error fetching user enabled AI agents');
  }
}
