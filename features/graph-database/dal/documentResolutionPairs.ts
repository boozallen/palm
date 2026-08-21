import { logger } from '@/server/logger';
import db from '@/server/db';
import type { MarkResolvedParams } from '@/features/graph-database/types';

/**
 * Canonicalize document pair - ensures doc1Id < doc2Id for consistent storage
 */
function canonicalize(docId1: string, docId2: string): [string, string] {
  return docId1 < docId2 ? [docId1, docId2] : [docId2, docId1];
}

/**
 * Mark a document pair as resolved with resolution stats
 * Uses upsert to handle re-resolution gracefully (updates stats if already exists)
 */
export async function markDocumentPairResolved(params: MarkResolvedParams): Promise<void> {
  const [document1Id, document2Id] = canonicalize(params.document1Id, params.document2Id);

  try {
    await db.documentResolutionPair.upsert({
      where: {
        document1Id_document2Id: {
          document1Id,
          document2Id,
        },
      },
      create: {
        document1Id,
        document2Id,
        userId: params.userId,
        candidatesGenerated: params.candidatesGenerated,
        identityEdgesCreated: params.identityEdgesCreated,
        similarEdgesCreated: params.similarEdgesCreated,
        relatedEdgesCreated: params.relatedEdgesCreated,
      },
      update: {
        resolvedAt: new Date(),
        candidatesGenerated: params.candidatesGenerated,
        identityEdgesCreated: params.identityEdgesCreated,
        similarEdgesCreated: params.similarEdgesCreated,
        relatedEdgesCreated: params.relatedEdgesCreated,
      },
    });

    logger.debug('[RESOLUTION-PAIRS] Marked pair resolved', {
      document1Id: document1Id.substring(0, 8),
      document2Id: document2Id.substring(0, 8),
      identityEdges: params.identityEdgesCreated,
      similarEdges: params.similarEdgesCreated,
    });
  } catch (error) {
    logger.error('[RESOLUTION-PAIRS] Failed to mark pair resolved', {
      document1Id,
      document2Id,
      error: (error as Error).message,
    });
    throw new Error('Failed to mark document pair as resolved');
  }
}

/**
 * Check if a specific document pair has already been resolved
 */
export async function isDocumentPairResolved(
  docId1: string,
  docId2: string
): Promise<boolean> {
  const [document1Id, document2Id] = canonicalize(docId1, docId2);

  const pair = await db.documentResolutionPair.findUnique({
    where: {
      document1Id_document2Id: {
        document1Id,
        document2Id,
      },
    },
  });

  return pair !== null;
}

/**
 * Get document IDs that have NOT been resolved against a given document
 * Used for true incremental resolution - skip entirely for already-resolved pairs
 *
 * @param userId - User ID to scope the query
 * @param newDocId - The new document to check against
 * @param existingDocIds - List of existing graphed document IDs to check
 * @returns Array of document IDs that still need resolution against newDocId
 */
export async function getUnresolvedDocumentIds(
  userId: string,
  newDocId: string,
  existingDocIds: string[]
): Promise<string[]> {
  if (existingDocIds.length === 0) {
    return [];
  }

  // Find all pairs that have already been resolved
  const resolvedPairs = await db.documentResolutionPair.findMany({
    where: {
      userId,
      OR: existingDocIds.map((docId) => {
        const [doc1, doc2] = canonicalize(docId, newDocId);
        return {
          document1Id: doc1,
          document2Id: doc2,
        };
      }),
    },
    select: {
      document1Id: true,
      document2Id: true,
    },
  });

  // Extract the resolved document IDs (the one that's not newDocId)
  const resolvedDocIds = new Set<string>();
  for (const pair of resolvedPairs) {
    if (pair.document1Id === newDocId) {
      resolvedDocIds.add(pair.document2Id);
    } else {
      resolvedDocIds.add(pair.document1Id);
    }
  }

  // Filter out resolved docs
  const unresolvedDocIds = existingDocIds.filter((id) => !resolvedDocIds.has(id));

  logger.info('[RESOLUTION-PAIRS] Checked unresolved pairs', {
    newDocId: newDocId.substring(0, 8),
    existingCount: existingDocIds.length,
    resolvedCount: resolvedPairs.length,
    unresolvedCount: unresolvedDocIds.length,
  });

  return unresolvedDocIds;
}

/**
 * Get all resolved pairs for a user
 * Useful for debugging and stats display
 */
export async function getResolvedPairsForUser(
  userId: string,
  limit: number = 100
): Promise<Array<{
  document1Id: string;
  document2Id: string;
  resolvedAt: Date;
  candidatesGenerated: number;
  identityEdgesCreated: number;
  similarEdgesCreated: number;
  relatedEdgesCreated: number;
}>> {
  return db.documentResolutionPair.findMany({
    where: { userId },
    orderBy: { resolvedAt: 'desc' },
    take: limit,
  });
}

/**
 * Get count of resolved pairs for a user
 */
export async function getResolvedPairCount(userId: string): Promise<number> {
  return db.documentResolutionPair.count({
    where: { userId },
  });
}

/**
 * Delete all resolution pairs involving a specific document
 * Called when a document is deleted to maintain consistency
 */
export async function deleteResolutionPairsForDocument(documentId: string): Promise<number> {
  const result = await db.documentResolutionPair.deleteMany({
    where: {
      OR: [{ document1Id: documentId }, { document2Id: documentId }],
    },
  });

  logger.info('[RESOLUTION-PAIRS] Deleted pairs for document', {
    documentId: documentId.substring(0, 8),
    deletedCount: result.count,
  });

  return result.count;
}
