import { AiAgentType, AiAgent } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

type NewAiAgent = {
  name: string;
  description: string;
  type: AiAgentType;
};

export default async function createAiAgent(
  input: NewAiAgent
): Promise<AiAgent> {
  try {
    const response = await db.aiAgent.create({
      data: {
        name: input.name,
        description: input.description,
        agentType: input.type,
      },
    });

    // Note: label maps to database field 'name' for consistency with UI naming convention
    return {
      id: response.id,
      label: response.name,
      description: response.description,
      type: response.agentType,
    };
  } catch (error) {
    logger.error('Error creating AI agent', error);
    throw new Error('Error creating AI agent');
  }
}
