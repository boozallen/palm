import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

/**
 * Deletes a specific checklist item from the AgentSwearChecklistItem table
 * @param {string} itemId
 */
export default async function deleteSwearChecklistItem(itemId: string) {
  try {
    const deletedItem = await db.agentSwearChecklistItem.delete({
      where: { id: itemId },
      select: {
        id: true,
        aiAgentId: true,
      },
    });

    return {
      id: deletedItem.id,
      aiAgentId: deletedItem.aiAgentId,
    };
  } catch (error) {
    logger.error('Error deleting SWEAR checklist item', error);
    throw new Error(handlePrismaError(error));
  }
}
