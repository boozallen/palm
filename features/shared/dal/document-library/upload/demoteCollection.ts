import db from '@/server/db';
import logger from '@/server/logger';
import demoteAdminDocument from './demoteAdminDocument';

type DemoteCollectionResult = {
  demotedCount: number;
};

// Removes admin data source status from every admin document in a collection
// and clears the collection's shared flag. This is the inverse of sharing a
// folder: it revokes group access to the documents and stops the folder from
// surfacing read-only to recipients.
export default async function demoteCollection(
  collectionId: string
): Promise<DemoteCollectionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const adminMemberships = await tx.documentCollectionMembership.findMany({
        where: { collectionId, document: { adminCreated: true } },
        select: { documentId: true },
      });

      for (const { documentId } of adminMemberships) {
        await demoteAdminDocument(documentId, tx);
      }

      await tx.documentCollection.update({
        where: { id: collectionId },
        data: { adminCreated: false },
      });

      return { demotedCount: adminMemberships.length };
    });
  } catch (error) {
    logger.error(`Error demoting collection: CollectionId: ${collectionId}`, error);
    throw new Error('Error removing folder share status');
  }
}
