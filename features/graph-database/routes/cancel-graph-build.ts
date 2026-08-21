import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { procedure } from '@/server/trpc';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { getGraphBuildQueue } from '@/features/graph-database/utils/worker/queue';
import { requestGraphCancellation, clearGraphCancellation } from '@/features/graph-database/utils/graphCancellation';
import { rollbackCancelledBuild } from '@/features/graph-database/dal/rollbackCancelledBuild';
import { cancelRunningBuildRunsForGraph } from '@/features/graph-database/dal/graphBuildRuns';

const inputSchema = z.object({
  graphId: z.string(),
});

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  // True once rollback has already run synchronously (queued/no-active-job
  // path) — the graph's state is final by the time this response is received.
  // False when an active job was found: the worker settles it later at its
  // next checkpoint, so callers must not treat state as final yet.
  settled: z.boolean(),
});

const CANCELLABLE_STATUSES: string[] = [
  GraphBuildStatus.Pending,
  GraphBuildStatus.Building,
  GraphBuildStatus.Resolving,
];

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { graphId } = input;

    ctx.logger.info(`[GRAPH-BUILD] Graph build cancellation requested for ${graphId}`);

    const graphMetadata = await db.graphMetadata.findUnique({
      where: { graphId },
    });

    if (!graphMetadata) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Graph not found',
      });
    }

    if (graphMetadata.userId !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to cancel this graph build',
      });
    }

    if (graphMetadata.status === GraphBuildStatus.Cancelling) {
      return {
        success: false,
        message: 'Cancellation already in progress',
        settled: false,
      };
    }

    if (!CANCELLABLE_STATUSES.includes(graphMetadata.status)) {
      return {
        success: false,
        message: `Graph is in ${graphMetadata.status} state and cannot be cancelled`,
        settled: true,
      };
    }

    // Set the flag before touching the queue — even if no job is ever found
    // below (build finished a moment ago), a stale flag left set is harmless
    // (it is cleared before the next enqueue), but a missed flag on an actually-
    // active job would let the worker run to completion uncancelled.
    await requestGraphCancellation(graphId);

    const queue = getGraphBuildQueue();
    if (!queue) {
      ctx.logger.error('[GRAPH-BUILD] Graph build queue not available');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Graph build service is not available',
      });
    }

    try {
      const jobs = await queue.getJobs(['active', 'waiting', 'delayed']);
      const graphJobs = jobs.filter((job) => job.data.graphId === graphId);

      let activeCount = 0;
      const cancelledExtractDocumentIds = new Set<string>();

      for (const job of graphJobs) {
        (job.data.extractDocumentIds ?? []).forEach((id) => cancelledExtractDocumentIds.add(id));
        try {
          await job.remove();
        } catch {
          // Locked by the worker — it owns settling this build via the checkpoint flag.
          activeCount++;
        }
      }

      if (activeCount > 0) {
        // Conditional transition, not a blind update: the active job can finish
        // in the instant between remove() throwing and this write. A blind
        // update would overwrite the worker's fresh terminal status with
        // Cancelling — and with the job gone, nothing would ever settle it
        // (stalled recovery only runs at worker startup or on queue events).
        const marked = await db.graphMetadata.updateMany({
          where: { graphId, status: { in: CANCELLABLE_STATUSES } },
          data: {
            status: GraphBuildStatus.Cancelling,
            errorMessage: null,
          },
        });

        if (marked.count > 0) {
          ctx.logger.info(`[GRAPH-BUILD] Graph build marked Cancelling, worker will settle: ${graphId}`);

          return {
            success: true,
            message: 'Cancelling build — it will stop at the next checkpoint. Your existing graph is preserved.',
            settled: false,
          };
        }

        const raced = await db.graphMetadata.findUnique({
          where: { graphId },
          select: { status: true },
        });
        if (raced?.status === GraphBuildStatus.Cancelling) {
          // A concurrent cancel won the transition — the worker owns settling it.
          return {
            success: false,
            message: 'Cancellation already in progress',
            settled: false,
          };
        }

        // The build reached a terminal state in the race window. Honor the
        // cancel anyway — same outcome as remove() succeeding on a
        // just-finished job below: full undo of the run the user asked to stop.
        ctx.logger.info(`[GRAPH-BUILD] Build settled (${raced?.status}) during cancel race, rolling back: ${graphId}`);
      }

      // No job left to settle this build — removed cleanly from the queue,
      // never found at all (build just finished / job already gone), or it
      // settled during the race window above. Either way the worker will never
      // act on this cancel, so roll back immediately: never leave the row
      // parked on Cancelling with no worker left to settle it.
      await rollbackCancelledBuild({
        graphId,
        userId: ctx.userId,
        extractDocumentIds: Array.from(cancelledExtractDocumentIds),
      });
      await cancelRunningBuildRunsForGraph(graphId);
      await clearGraphCancellation(graphId);

      ctx.logger.info(`[GRAPH-BUILD] Graph build cancelled and rolled back: ${graphId}`);

      return {
        success: true,
        message: 'Build cancelled.',
        settled: true,
      };
    } catch (error) {
      ctx.logger.error(`[GRAPH-BUILD] Error cancelling graph build: ${graphId}`, error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to cancel graph build',
      });
    }
  });
