import db from '@/server/db';
import logger from '@/server/logger';

type DeleteCollectionInput = {
  collectionId: string;
  userId: string;
};

export default async function deleteCollection(input: DeleteCollectionInput) {
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

    // Delete the collection (cascade will handle memberships)
    await db.documentCollection.delete({
      where: {
        id: input.collectionId,
      },
    });

    return { success: true };
  } catch (error) {
    logger.error('Error deleting document collection', error);
    throw new Error('Error deleting document collection');
  }
}
