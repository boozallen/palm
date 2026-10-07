import db from '@/server/db';
import logger from '@/server/logger';

type RemoveDocumentFromCollectionInput = {
  documentId: string;
  collectionId: string;
  userId: string;
};

export default async function removeDocumentFromCollection(input: RemoveDocumentFromCollectionInput) {
  try {
    // Verify collection ownership
    const collection = await db.documentCollection.findFirst({
      where: {
        id: input.collectionId,
        userId: input.userId,
      },
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Remove from collection
    await db.documentCollectionMembership.delete({
      where: {
        documentId_collectionId: {
          documentId: input.documentId,
          collectionId: input.collectionId,
        },
      },
    });

    return { success: true };
  } catch (error) {
    logger.error('Error removing document from collection', error);
    throw new Error('Error removing document from collection');
  }
}
