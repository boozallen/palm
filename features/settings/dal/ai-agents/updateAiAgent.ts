import logger from '@/server/logger';
import db from '@/server/db';
import { AiAgent } from '@/features/shared/types';

export default async function updateAiAgent(agentData: AiAgent): Promise<AiAgent> {
  
  try {
    const result = await db.aiAgent.update({
      where: { id: agentData.id },
      data: {
        name: agentData.name,
        description: agentData.description,
      },
    });

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      type: result.agentType,
    };
  } catch (error) {
    logger.error(`Error updating AI Agent with id ${agentData.id}`, error);
    throw new Error('Error updating AI Agent');
  }
}
