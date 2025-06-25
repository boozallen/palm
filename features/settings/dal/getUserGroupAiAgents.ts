import db from '@/server/db';
import logger from '@/server/logger';

type AiAgent = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export default async function getUserGroupAiAgents(id: string): Promise<AiAgent[]> {
  try {
    const results = await db.userGroup.findUniqueOrThrow({
      where: {
        id: id,
      },
      select: {
        aiAgents: true,
      },
    });

    // Filter to only include system-enabled agents
    const enabledAgents = results.aiAgents
      .filter(agent => agent.enabled)
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        enabled: agent.enabled,
      }));

    return enabledAgents;

  } catch (error) {
    logger.error('Error getting user group AI agents', error);
    throw new Error('Error getting user group AI agents');
  }
}
