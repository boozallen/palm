import { AiAgent } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteAiAgent(agentId: string): Promise<AiAgent> {
  try {
    const response = await db.aiAgent.delete({
      where: {
        id: agentId,
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
    logger.error('Error deleting AI agent: ', error);
    throw new Error('Failed to delete AI agent');
  }
}
