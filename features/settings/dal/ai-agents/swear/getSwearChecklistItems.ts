import { SwearChecklistItem } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

/**
 * Gets all checklist items for a specified SWEAR agent.
 * @param {string} id The agent id
 */
export default async function getSwearChecklistItems(id: string): Promise<SwearChecklistItem[]> {
  try {
    const items = await db.agentSwearChecklistItem.findMany({
      where: {
        aiAgentId: id,
      },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
      ],
    });

    return items.map((item) => ({
      id: item.id,
      aiAgentId: item.aiAgentId,
      category: item.category,
      item: item.item,
      sortOrder: item.sortOrder,
    }));
  } catch (error) {
    logger.error('Error fetching SWEAR checklist items: ', error);
    throw new Error('Error fetching SWEAR checklist items');
  }
}
