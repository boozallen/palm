import { SwearChecklistItem } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

type NewSwearChecklistItem = {
  aiAgentId: string;
  category: string;
  item: string;
  sortOrder: number;
};

export default async function createSwearChecklistItem(
  input: NewSwearChecklistItem,
): Promise<SwearChecklistItem> {
  try {
    const response = await db.agentSwearChecklistItem.create({
      data: input,
    });

    return {
      id: response.id,
      aiAgentId: response.aiAgentId,
      category: response.category,
      item: response.item,
      sortOrder: response.sortOrder,
    };
  } catch (error) {
    logger.error('Error creating SWEAR checklist item:', error);
    throw new Error('Error creating SWEAR checklist item');
  }
}
