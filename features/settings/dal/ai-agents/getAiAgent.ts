import { AiAgent } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getAiAgent(id: string): Promise<AiAgent> {
  let result = null;
  try {
    result = await db.aiAgent.findUnique({
      where: {
        id,
      },
    });
  } catch (error) {
    logger.error('Error fetching AI agent:', error);
    throw new Error('Error fetching AI agent');
  }

  if (!result) {
    logger.warn('AI Agent not found', id);
    throw new Error('AI Agent not found');
  }

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    enabled: result.enabled,
  };
}
