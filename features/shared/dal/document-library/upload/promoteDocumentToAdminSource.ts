import { Prisma } from '@prisma/client';

import logger from '@/server/logger';
import assignAdminDocumentGroups from './assignAdminDocumentGroups';

type PromoteDocumentToAdminSourceInput = {
  documentId: string;
  userGroupIds: string[];
  tx: Prisma.TransactionClient;
};

export default async function promoteDocumentToAdminSource(
  input: PromoteDocumentToAdminSourceInput
): Promise<void> {
  try {
    await input.tx.document.update({
      where: { id: input.documentId },
      data: { adminCreated: true },
    });

    await assignAdminDocumentGroups({
      documentId: input.documentId,
      userGroupIds: input.userGroupIds,
      tx: input.tx,
    });
  } catch (error) {
    logger.error(`Error promoting document to admin source: DocumentId: ${input.documentId}`, error);
    throw new Error('Error promoting document to admin source');
  }
}
