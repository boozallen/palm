import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

export type SoftDeleteSharedDocumentInput = {
  sourceDocumentId: string;
  sourceUserId: string;
};

/**
 * Soft deletes shared documents by setting deletedAt timestamp.
 * This preserves the SharedDocument record and all associated SharedDocumentAction records
 * for audit/history purposes while effectively "expiring" the share.
 */
export default async function softDeleteSharedDocument(
  input: SoftDeleteSharedDocumentInput
): Promise<void> {
  try {
    await db.sharedDocument.updateMany({
      where: {
        sourceDocumentId: input.sourceDocumentId,
        sourceUserId: input.sourceUserId,
        deletedAt: null, // Only soft delete active shares
      },
      data: {
        deletedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to soft delete shared document', {
      error: error instanceof Error ? error.message : String(error),
      sourceDocumentId: input.sourceDocumentId,
      sourceUserId: input.sourceUserId,
    });
    throw new Error(handlePrismaError(error as Error));
  }
}