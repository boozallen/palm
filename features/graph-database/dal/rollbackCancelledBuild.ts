import { logger } from '@/server/logger';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';
import deleteGraphNodes from '@/features/graph-database/dal/deleteGraphNodes';
import { deleteResolutionPairsForDocument } from '@/features/graph-database/dal/documentResolutionPairs';
import { reconcileIdentityClusterHubs } from '@/features/graph-database/services/reconcileIdentityClusterHubs';

export interface RollbackCancelledBuildParams {
  graphId: string;
  userId: string;
  /** Docs newly extracted THIS run — the only safe delete scope. Docs pending
   * only re-resolution (previously graphed) are never in this set and are
   * never touched. */
  extractDocumentIds: string[];
}

/**
 * Cancel path: full undo of this run — "as if Graph was never clicked".
 *
 * For every doc in `extractDocumentIds`, deletes its Neo4j entities/concepts/
 * chunks/Document node (which also destroys the extraction/resolution
 * markers, so the build gate genuinely treats it as never graphed) and its
 * Postgres embedding rows, then settles the graph's status/membership.
 *
 * Docs in the run that were only pending re-resolution (previously graphed)
 * are untouched — their data stays; they simply never get resolution-marked,
 * so the next build re-resolves them cleanly.
 */
export async function rollbackCancelledBuild({
  graphId,
  userId,
  extractDocumentIds,
}: RollbackCancelledBuildParams): Promise<void> {
  for (const docId of extractDocumentIds) {
    try {
      await deleteGraphNodes(docId);
      await db.$executeRaw`DELETE FROM "graph_entity_embeddings" WHERE "documentId" = ${docId}::uuid`;
      await db.$executeRaw`DELETE FROM "graph_concept_embeddings" WHERE "documentId" = ${docId}::uuid`;
      // Pair-resolved rows for a doc that no longer exists in the graph are
      // stale history — and a cancel can land after resolution already wrote
      // them (legitimately or as a between-blocks no-op).
      await deleteResolutionPairsForDocument(docId);
    } catch (error) {
      logger.error('[GRAPH-BUILD] Failed to delete graph data for cancelled doc, continuing rollback', {
        graphId,
        docId,
        error,
      });
    }
  }

  if (extractDocumentIds.length > 0) {
    try {
      await reconcileIdentityClusterHubs();
    } catch (error) {
      logger.error('[GRAPH-BUILD] Hub reconciliation failed during rollback, continuing', { graphId, error });
    }
  }

  try {
    const row = await db.graphMetadata.findUnique({
      where: { graphId },
      select: { documentIds: true },
    });
    const currentDocumentIds = (row?.documentIds as string[] | undefined) ?? [];
    const settled = currentDocumentIds.filter((id) => !extractDocumentIds.includes(id));

    if (settled.length > 0) {
      await db.graphMetadata.update({
        where: { graphId },
        data: {
          status: GraphBuildStatus.Completed,
          documentIds: settled,
          errorMessage: null,
        },
      });
    } else {
      await db.graphMetadata.update({
        where: { graphId },
        data: {
          status: GraphBuildStatus.Cancelled,
          documentIds: settled,
          errorMessage: 'Build cancelled by user',
        },
      });
    }

    logger.info('[GRAPH-BUILD] Rolled back cancelled build', {
      graphId,
      userId,
      deletedDocs: extractDocumentIds.length,
      settledCount: settled.length,
    });
  } catch (error) {
    logger.error('[GRAPH-BUILD] Failed to settle graph metadata after rollback', { graphId, userId, error });
    throw new Error('Failed to roll back cancelled build');
  }
}
