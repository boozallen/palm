import { logger } from '@/server/logger';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { getExtractedDocumentIds } from '@/features/graph-database/dal/getExtractedDocumentIds';

export interface SettleFailedBuildParams {
  graphId: string;
  userId: string;
  extractDocumentIds: string[];
  errorMessage: string;
}

/**
 * Failure path: preserve for resume — deletes nothing. The partial graph IS
 * the resume checkpoint; markers make a future resume cheap. Only called once
 * BullMQ is out of retries (the worker gates on the final attempt).
 *
 * Finished docs stay badged (settled into membership); only the doc that was
 * mid-extraction when the crash happened leaves membership, keeping its
 * partial chunks on disk for resume.
 *
 * The settled row keeps `status: Completed` (the graph IS valid and usable for
 * its settled membership — Failed would blank badges and reads for every doc
 * in it) but PRESERVES `errorMessage`: a Completed row with an errorMessage is
 * the settled-failure record, which the client surfaces as a failure
 * notification instead of the success tooltip. Genuine completions clear it.
 */
export async function settleFailedBuild({
  graphId,
  userId,
  extractDocumentIds,
  errorMessage,
}: SettleFailedBuildParams): Promise<void> {
  const row = await db.graphMetadata.findUnique({
    where: { graphId },
    select: { documentIds: true },
  });
  const currentDocumentIds = (row?.documentIds as string[] | undefined) ?? [];

  const extractedDocIds = await getExtractedDocumentIds(userId);
  const unfinished = extractDocumentIds.filter((id) => !extractedDocIds.includes(id));
  const settled = currentDocumentIds.filter((id) => !unfinished.includes(id));

  if (settled.length > 0) {
    await db.graphMetadata.update({
      where: { graphId },
      data: {
        status: GraphBuildStatus.Completed,
        documentIds: settled,
        errorMessage,
      },
    });
  } else {
    await db.graphMetadata.update({
      where: { graphId },
      data: {
        status: GraphBuildStatus.Failed,
        errorMessage,
      },
    });
  }

  logger.info('[GRAPH-BUILD] Settled failed build', {
    graphId,
    userId,
    unfinishedCount: unfinished.length,
    settledCount: settled.length,
  });
}
