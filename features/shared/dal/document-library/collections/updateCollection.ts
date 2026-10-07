import db from '@/server/db';
import logger from '@/server/logger';

type UpdateCollectionInput = {
  collectionId: string;
  userId: string;
  name?: string;
  color?: string;
};

export default async function updateCollection(input: UpdateCollectionInput) {
  try {
    // Verify ownership
    const existing = await db.documentCollection.findFirst({
      where: {
        id: input.collectionId,
        userId: input.userId,
      },
    });

    if (!existing) {
      throw new Error('Collection not found or access denied');
    }

    const collection = await db.documentCollection.update({
      where: {
        id: input.collectionId,
      },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
      },
    });

    return collection;
  } catch (error) {
    logger.error('Error updating document collection', error);
    throw new Error('Error updating document collection');
  }
}
