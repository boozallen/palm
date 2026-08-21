import db from '@/server/db';
import logger from '@/server/logger';

type AddDocumentToCollectionInput = {
  documentId: string;
  collectionId: string;
  userId: string;
};

export default async function addDocumentToCollection(input: AddDocumentToCollectionInput) {
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

    // Verify document ownership or access
    const document = await db.document.findFirst({
      where: {
        id: input.documentId,
        OR: [
          { userId: input.userId },
          {
            adminCreated: true,
            accessUsers: { some: { id: input.userId } },
          },
        ],
      },
    });

    if (!document) {
      throw new Error('Document not found or access denied');
    }

    // Add to collection (upsert to handle duplicates gracefully)
    const membership = await db.documentCollectionMembership.upsert({
      where: {
        documentId_collectionId: {
          documentId: input.documentId,
          collectionId: input.collectionId,
        },
      },
      create: {
        documentId: input.documentId,
        collectionId: input.collectionId,
      },
      update: {},
    });

    return membership;
  } catch (error) {
    logger.error('Error adding document to collection', error);
    throw new Error('Error adding document to collection');
  }
}
