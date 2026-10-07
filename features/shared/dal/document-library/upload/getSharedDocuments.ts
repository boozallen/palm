import db from '@/server/db';
import logger from '@/server/logger';
import {
  IncomingSharedDocument,
  OutgoingSharedDocument,
  GetSharedDocumentsResult,
} from '@/features/shared/types/document';
import { getSharedDocumentExpirationDate } from '@/features/shared/utils/dateUtils';

type GetSharedDocumentsInput = {
  userId: string;
  userGroupIds: string[];
};

export default async function getSharedDocuments(
  input: GetSharedDocumentsInput
): Promise<GetSharedDocumentsResult> {
  const { userId, userGroupIds } = input;

  try {
    const expirationDate = getSharedDocumentExpirationDate();
    // Query for incoming shares (documents shared with the user)
    const incomingSharesPromise =
      userGroupIds.length > 0
        ? db.sharedDocument.findMany({
            where: {
              sharedWithUserGroupIds: {
                hasSome: userGroupIds,
              },
              deletedAt: null,
              createdAt: {
                gt: expirationDate,
              },
              sourceUserId: {
                not: userId,
              },
              actions: {
                none: {
                  userId: userId,
                },
              },
            },
            include: {
              sourceDocument: true,
              sourceUser: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : Promise.resolve([]);

    // Query for outgoing shares (documents shared by the user)
    const outgoingSharesPromise = db.sharedDocument.findMany({
      where: {
        sourceUserId: userId,
        deletedAt: null,
        createdAt: {
          gt: expirationDate,
        },
      },
      include: {
        sourceDocument: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const [incomingSharesResults, outgoingSharesResults] = await Promise.all([
      incomingSharesPromise,
      outgoingSharesPromise,
    ]);

    const incomingShares: IncomingSharedDocument[] = incomingSharesResults.map(
      (result) => ({
        id: result.id,
        sourceDocumentId: result.sourceDocumentId,
        sourceUserId: result.sourceUserId,
        sourceFilename: result.sourceDocument.filename,
        sharedByUsername: result.sourceUser.name,
        createdAt: result.createdAt,
      })
    );

    const outgoingShares: OutgoingSharedDocument[] = outgoingSharesResults.map(
      (result) => ({
        id: result.id,
        documentId: result.sourceDocumentId,
        filename: result.sourceDocument.filename,
        sharedWithUserGroupIds: result.sharedWithUserGroupIds,
        createdAt: result.createdAt,
      })
    );

    return {
      incoming: incomingShares,
      outgoing: outgoingShares,
    };
  } catch (error) {
    logger.error('Error getting shared documents', error);
    throw new Error('Error getting shared documents');
  }
}
