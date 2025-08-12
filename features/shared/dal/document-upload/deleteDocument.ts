import db from '@/server/db';
import logger from '@/server/logger';

type DeleteDocumentResponse = {
  id: string;
};

export default async function deleteDocument(documentId: string): Promise<DeleteDocumentResponse> {
  try {
    const deletionResult = await db.document.delete({
      where: { id: documentId },
    });

    return {
      id: deletionResult.id,
    };
  } catch (error) {
    logger.error(`Error deleting document from the database. Id: ${documentId}`, error);
    throw new Error('Error deleting document');
  }
}
