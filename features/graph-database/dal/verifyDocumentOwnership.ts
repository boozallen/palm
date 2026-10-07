import { logger } from '@/server/logger';
import db from '@/server/db';

/**
 * Verify that a user owns all the specified documents
 * Returns true if user owns all documents, false otherwise
 */
export default async function verifyDocumentOwnership(
  userId: string,
  documentIds: string[]
): Promise<boolean> {
  try {
    const documents = await db.document.findMany({
      where: {
        id: { in: documentIds },
        userId: userId,
      },
      select: { id: true },
    });

    if (documents.length !== documentIds.length) {
      const foundIds = documents.map(d => d.id);
      const missingIds = documentIds.filter(id => !foundIds.includes(id));
      logger.warn(`User ${userId} does not own all requested documents. Missing: ${missingIds.join(', ')}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Error verifying document ownership for user ${userId}:`, error);
    throw new Error('Failed to verify document ownership');
  }
}
