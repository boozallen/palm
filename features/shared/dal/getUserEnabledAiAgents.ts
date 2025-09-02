import logger from '@/server/logger';
import db from '@/server/db';
import { AiAgent, AiAgentType } from '@/features/shared/types/ai-agent';

export default async function getUserEnabledAiAgents(
  userId: string
): Promise<AiAgent[]> {
  try {
    const results = await db.aiAgent.findMany({
      where: {
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
        agentType: true, 
      },
    });

    // Note: label maps to database field 'name' for consistency with UI naming convention
    return results.map((row) => ({
      id: row.id,
      label: row.name,
      description: row.description,
      type: row.agentType as AiAgentType, 
    }));
    
  } catch (error) {
    logger.error('Error fetching user enabled AI agents', error);
    throw new Error('Error fetching user enabled AI agents');
  }
}
