import db from '@/server/db';
import logger from '@/server/logger';
import defaultChecklistItems from '@/features/ai-agents/types/swear/defaultChecklistItems';

export default async function seedDefaultChecklistItems(
  aiAgentId: string
): Promise<void> {
  try {
    const itemsToCreate = defaultChecklistItems.map((item) => ({
      aiAgentId,
      category: item.category,
      item: item.item,
      sortOrder: item.sortOrder,
    }));

    await db.agentSwearChecklistItem.createMany({
      data: itemsToCreate,
    });

    logger.info(`Seeded ${itemsToCreate.length} default checklist items for SWEAR agent ${aiAgentId}`);
  } catch (error) {
    logger.error('Error seeding default SWEAR checklist items:', error);
    throw new Error('Error seeding default SWEAR checklist items');
  }
}
