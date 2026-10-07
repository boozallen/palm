import db from '@/server/db';
import logger from '@/server/logger';

type GetDocumentCollectionsInput = {
  documentId: string;
  userId: string;
};

export default async function getDocumentCollections(input: GetDocumentCollectionsInput) {
  try {
    // Verify document access
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

    // Get collections for this document
    const memberships = await db.documentCollectionMembership.findMany({
      where: {
        documentId: input.documentId,
      },
      include: {
        collection: true,
      },
    });

    return memberships.map(m => m.collection);
  } catch (error) {
    logger.error('Error getting document collections', error);
    throw new Error('Error getting document collections');
  }
}
