import logger from '@/server/logger';
import db from '@/server/db';
import { AiAgent, AiAgentType } from '@/features/shared/types';

type UpdateAiAgentData = {
  id: string;
  name: string;
  description: string;
  type: AiAgentType;
};

export default async function updateAiAgent(agentData: UpdateAiAgentData): Promise<AiAgent> {
  
  try {
    const result = await db.aiAgent.update({
      where: { id: agentData.id },
      data: {
        name: agentData.name,
        description: agentData.description,
      },
    });

    // Note: label maps to database field 'name' for consistency with UI naming convention
    return {
      id: result.id,
      label: result.name,
      description: result.description,
      type: result.agentType,
    };
  } catch (error) {
    logger.error(`Error updating AI Agent with id ${agentData.id}`, error);
    throw new Error('Error updating AI Agent');
  }
}
