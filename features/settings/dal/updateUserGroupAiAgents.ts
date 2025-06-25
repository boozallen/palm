import db from '@/server/db';
import logger from '@/server/logger';

type UpdateUserGroupAiAgentsInput = {
  userGroupId: string;
  aiAgentId: string;
  enabled: boolean;
};

type AiAgent = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export default async function updateUserGroupAiAgents(input: UpdateUserGroupAiAgentsInput):
  Promise<AiAgent[]> {

  const connectToAiAgent = {
    connect: {
      id: input.aiAgentId,
    },
  };
  const disconnectFromAiAgent = {
    disconnect: {
      id: input.aiAgentId,
    },
  };

  try {
    const updatedUserGroup = await db.userGroup.update({
      where: {
        id: input.userGroupId,
      },
      data: {
        aiAgents: input.enabled ? connectToAiAgent : disconnectFromAiAgent,
      },
      select: {
        aiAgents: true,
      },
    });

    return updatedUserGroup.aiAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      enabled: agent.enabled,
    }));
    
  } catch (error) {
    logger.error('Error updating the user group\'s AI Agents', error);
    throw new Error('Error updating the user group\'s AI Agents');
  }
};
