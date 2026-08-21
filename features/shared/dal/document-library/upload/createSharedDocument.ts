import db from '@/server/db';
import { SharedDocument } from '@/features/shared/types/document';
import logger from '@/server/logger';

type CreateSharedDocumentInput = {
  sourceDocumentId: string;
  sourceUserId: string;
  sharedWithUserGroupIds: string[];
};

export default async function createSharedDocument(
  input: CreateSharedDocumentInput
): Promise<SharedDocument> {
  try {
    const result = await db.sharedDocument.create({
      data: {
        sourceDocumentId: input.sourceDocumentId,
        sourceUserId: input.sourceUserId,
        sharedWithUserGroupIds: input.sharedWithUserGroupIds,
      },
    });

    return {
      id: result.id,
      sourceDocumentId: result.sourceDocumentId,
      sourceUserId: result.sourceUserId,
      sharedWithUserGroupIds: result.sharedWithUserGroupIds,
      createdAt: result.createdAt,
      deletedAt: result.deletedAt ?? undefined,
    };
  } catch (error) {
    logger.error(`Error creating shared document: DocumentId: ${input.sourceDocumentId}`, error);
    throw new Error('Error creating shared document');
  }
}
