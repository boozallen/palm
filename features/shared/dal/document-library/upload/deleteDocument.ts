import db from '@/server/db';
import logger from '@/server/logger';
import deleteGraphNodes from '@/features/graph-database/dal/deleteGraphNodes';

type DeleteDocumentResponse = {
  id: string;
};

export default async function deleteDocument(documentId: string): Promise<DeleteDocumentResponse> {
  try {
    // Transaction wrapper used solely for timeout config
    // Cascade delete of 6000+ embeddings exceeds Prisma's default 5s query timeout
    const deletionResult = await db.$transaction(async (prisma) => {
      return await prisma.document.delete({
        where: { id: documentId },
      });
    }, { timeout: 25000 });

    // Remove related nodes from knowledge graph (separate data store, outside transaction)
    try {
      await deleteGraphNodes(documentId);
    } catch (graphError) {
      logger.error(`Document ${documentId} deleted from DB, but graph node deletion failed:`, graphError);
      // Don't throw - document is already deleted, handle graph cleanup separately
      // TODO: Consider adding to a retry queue or cleanup job
    }

    return {
      id: deletionResult.id,
    };
  } catch (error) {
    logger.error(`Error deleting document from the database. Id: ${documentId}`, error);
    throw new Error('Error deleting document');
  }
}
