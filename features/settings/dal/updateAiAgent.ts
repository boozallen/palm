import logger from '@/server/logger';
import db from '@/server/db';

export default async function updateAiAgent(id: string, enabled: boolean) {
  let result = null;
  try {
    result = await db.aiAgent.update({
      where: { id },
      data: { enabled },
    });
  } catch (error) {
    logger.error(`Error updating AI Agent with id ${id}`, error);
    throw new Error('Error updating AI Agent');
  }

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    enabled: result.enabled,
  };
}
