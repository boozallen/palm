import { SwearChecklistItem } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

type UpdateSwearChecklistItem = {
  id: string;
  category: string;
  item: string;
  sortOrder: number;
};

export default async function updateSwearChecklistItem(
  input: UpdateSwearChecklistItem,
): Promise<SwearChecklistItem> {
  try {
    const checklistItem = await db.agentSwearChecklistItem.findUnique({
      where: {
        id: input.id,
      },
      select: {
        id: true,
      },
    });

    if (!checklistItem) {
      logger.warn(`SWEAR checklist item could not be found: ${input.id}`);
      throw new Error('SWEAR checklist item could not be found.');
    }

    const updatedItem = await db.agentSwearChecklistItem.update({
      where: {
        id: input.id,
      },
      data: {
        category: input.category,
        item: input.item,
        sortOrder: input.sortOrder,
      },
      select: {
        id: true,
        category: true,
        item: true,
        sortOrder: true,
        aiAgentId: true,
      },
    });

    return {
      id: updatedItem.id,
      category: updatedItem.category,
      item: updatedItem.item,
      sortOrder: updatedItem.sortOrder,
      aiAgentId: updatedItem.aiAgentId,
    };
  } catch (error) {
    logger.error('Error updating SWEAR checklist item', error);
    throw new Error('Error updating SWEAR checklist item');
  }
}
