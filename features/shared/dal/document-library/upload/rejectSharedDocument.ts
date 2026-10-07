import db from '@/server/db';
import { SharedDocumentAction, SharedDocumentActionStatus } from '@/features/shared/types/document';
import logger from '@/server/logger';

type RejectSharedDocumentInput = {
  sharedDocumentId: string;
  userId: string;
  userGroupIds: string[];
};

export type RejectSharedDocumentResult = {
  action: SharedDocumentAction;
};

export default async function rejectSharedDocument(
  input: RejectSharedDocumentInput
): Promise<RejectSharedDocumentResult> {
  const { sharedDocumentId, userId, userGroupIds } = input;

  const result = await db.$transaction(async (prisma) => {
    // Get the shared document
    const sharedDocument = await prisma.sharedDocument.findUnique({
      where: { id: sharedDocumentId },
    });

    if (!sharedDocument) {
      throw new Error('Shared document not found');
    }

    if (sharedDocument.deletedAt) {
      throw new Error('This share has expired');
    }

    // Verify user has access (is in one of the shared groups)
    const hasAccess = sharedDocument.sharedWithUserGroupIds.some(
      (groupId) => userGroupIds.includes(groupId)
    );

    if (!hasAccess) {
      throw new Error('You do not have access to this shared document');
    }

    // Create the rejection action record
    const action = await prisma.sharedDocumentAction.create({
      data: {
        sharedDocumentId,
        userId,
        status: SharedDocumentActionStatus.Rejected,
      },
    });

    logger.info(`User ${userId} rejected shared document ${sharedDocumentId}`);

    return {
      action: {
        id: action.id,
        sharedDocumentId: action.sharedDocumentId,
        copiedDocumentId: action.copiedDocumentId ?? undefined,
        userId: action.userId,
        status: action.status as SharedDocumentActionStatus,
        createdAt: action.createdAt,
      },
    };
  });

  return result;
}
