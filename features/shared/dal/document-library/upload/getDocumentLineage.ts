import db from '@/server/db';
import logger from '@/server/logger';

export type DocumentLineageNode = {
  userId: string;
  userName: string;
  userEmail?: string;
  userGroupIds?: string[];
};

export type DocumentLineage = {
  depth: number;
  chain: DocumentLineageNode[];
};

/**
 * Recursively traces the sharing lineage of a document by following copiedFromAction relations.
 * Returns the depth (generation) and the full chain from original to current document.
 */
export default async function getDocumentLineage(documentId: string): Promise<DocumentLineage> {
  try {
    const chain: DocumentLineageNode[] = [];
    let currentDocId: string | null = documentId;
    let depth = 0;

    // Walk backwards through the lineage chain
    while (currentDocId) {
      // eslint-disable-next-line no-await-in-loop
      const document: {
        userId: string;
        user: {
          name: string;
          email: string | null;
          userGroupMemberhip: {
            userGroupId: string;
          }[];
        };
        copiedFromAction: {
          sharedDocument: {
            sourceDocumentId: string;
          };
        } | null;
      } | null = await db.document.findUnique({
        where: { id: currentDocId },
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              email: true,
              userGroupMemberhip: {
                select: {
                  userGroupId: true,
                },
              },
            },
          },
          copiedFromAction: {
            select: {
              sharedDocument: {
                select: {
                  sourceDocumentId: true,
                },
              },
            },
          },
        },
      });

      if (!document) {
        break;
      }

      // Add current document's user to the chain (at the beginning)
      chain.unshift({
        userId: document.userId,
        userName: document.user.name,
        userEmail: document.user.email ?? undefined,
        userGroupIds: document.user.userGroupMemberhip.map(m => m.userGroupId),
      });

      // Check if this document was copied from another
      if (document.copiedFromAction?.sharedDocument?.sourceDocumentId) {
        currentDocId = document.copiedFromAction.sharedDocument.sourceDocumentId;
        depth++;
      } else {
        // Reached the original document
        currentDocId = null;
      }
    }

    return {
      depth,
      chain,
    };
  } catch (error) {
    logger.error(`Error getting document lineage for documentId: ${documentId}`, error);
    throw new Error('Error getting document lineage');
  }
}
