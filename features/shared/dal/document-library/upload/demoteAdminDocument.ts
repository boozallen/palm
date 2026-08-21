import { Prisma } from '@prisma/client';

import logger from '@/server/logger';

// Revokes a document's admin data source status without deleting the document.
// The document remains in the creator's personal library. Runs inside the
// caller's transaction so it can be batched (e.g. demoting a whole folder).
export default async function demoteAdminDocument(
  documentId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  try {
    await tx.adminDocumentGroup.deleteMany({ where: { documentId } });

    await tx.document.update({
      where: { id: documentId },
      data: {
        adminCreated: false,
        accessUsers: { set: [] },
      },
    });
  } catch (error) {
    logger.error(`Error demoting admin document: DocumentId: ${documentId}`, error);
    throw new Error('Error removing data source');
  }
}
