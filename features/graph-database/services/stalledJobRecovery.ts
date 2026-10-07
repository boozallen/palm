import { QueueEvents } from 'bullmq';

import { logger } from '@/server/logger';
import db from '@/server/db';
import { getRedisClient } from '@/server/storage/redisConnection';
import { GraphBuildStatus } from '@/features/graph-database/types';

/**
 * A build whose `running` GraphBuildRun started longer ago than this is treated
 * as crashed, not slow. 10 minutes matches the worker `lockDuration` and the
 * historical manual-cleanup threshold; raise it if very large builds trip it.
 * Younger jobs are left untouched so a legitimate long build is never killed —
 * recovery is therefore eventual, not instant, by design.
 */
export const STALLED_JOB_THRESHOLD_MS = 10 * 60 * 1000;

const RECOVERY_ERROR_MESSAGE = 'Worker restarted while job was running; auto-recovered on startup';

const ACTIVE_STATUSES = [
  GraphBuildStatus.Building,
  GraphBuildStatus.Resolving,
  GraphBuildStatus.Pending,
  // A worker crash mid-rollback can strand a row here with no active job left
  // to ever settle it via the cancel flow — this sweep is its only way out.
  GraphBuildStatus.Cancelling,
];

let reconciler: QueueEvents | null = null;

/**
 * Repair a stale `buildProgress` for a graph being reverted to Completed, so the
 * UI never shows a finished graph as "Processing chunks 0/N". Prefer the chunk
 * count from `stats.extraction` (the source of truth) over the stale progress
 * value, which can carry a wrong total bled in from a later multi-doc attempt.
 */
function buildCompletedProgress(buildProgress: unknown, stats: unknown): Record<string, unknown> {
  const bp = (buildProgress && typeof buildProgress === 'object' ? buildProgress : {}) as Record<string, unknown>;
  const extraction = (stats && typeof stats === 'object'
    ? (stats as Record<string, unknown>).extraction
    : undefined) as Record<string, unknown> | undefined;

  const totalChunks =
    (typeof extraction?.totalChunks === 'number' ? extraction.totalChunks : undefined) ??
    (typeof bp.totalChunks === 'number' ? bp.totalChunks : undefined) ??
    0;

  return {
    ...bp,
    totalChunks,
    processedChunks: totalChunks,
    currentStep: 'Completed',
  };
}

/**
 * Reconcile Postgres-side orchestration state left behind when the graph-build
 * worker dies mid-run (crash, OOM, container restart, deploy).
 *
 * 1. Marks every `running` GraphBuildRun older than the threshold as `failed`.
 * 2. Reverts every graph_metadata row stuck in an active status (Building /
 *    Resolving / Pending / Cancelling) that has no fresh running job: to
 *    `Completed` (with a repaired buildProgress) when it had previously
 *    completed, otherwise to `Failed`.
 *
 * Postgres-status-only — the partial Neo4j graph is the durable checkpoint and
 * is preserved. Idempotent: a second run finds nothing to change. Per-row
 * failures are logged and skipped, never thrown.
 */
export async function recoverStalledJobs(): Promise<{ runsFailed: number; metadataReverted: number }> {
  const threshold = new Date(Date.now() - STALLED_JOB_THRESHOLD_MS);

  // 1. Fail stale 'running' build runs. completedAt/errorMessage are null on a
  //    running row, so an unconditional set is correct here.
  const failed = await db.graphBuildRun.updateMany({
    where: { status: 'running', startedAt: { lt: threshold } },
    data: {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: RECOVERY_ERROR_MESSAGE,
    },
  });
  const runsFailed = failed.count;

  // 2. Revert graph_metadata stuck in an active status with no fresh running job.
  const stuckGraphs = await db.graphMetadata.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    select: { graphId: true, completedAt: true, buildProgress: true, stats: true },
  });

  let metadataReverted = 0;
  for (const graph of stuckGraphs) {
    try {
      // Leave a graph alone if a legitimately fresh job is still running it.
      const freshRun = await db.graphBuildRun.findFirst({
        where: { graphId: graph.graphId, status: 'running', startedAt: { gte: threshold } },
        select: { id: true },
      });
      if (freshRun) {
        continue;
      }

      // completedAt is the unambiguous "was previously graphed" signal: revert to
      // Completed and repair progress; otherwise it never finished → Failed.
      const wasCompleted = graph.completedAt !== null;
      const data: { status: GraphBuildStatus; buildProgress?: object } = {
        status: wasCompleted ? GraphBuildStatus.Completed : GraphBuildStatus.Failed,
      };
      if (wasCompleted) {
        data.buildProgress = buildCompletedProgress(graph.buildProgress, graph.stats);
      }

      await db.graphMetadata.update({ where: { graphId: graph.graphId }, data });
      metadataReverted++;
    } catch (error) {
      logger.error('[GRAPH-BUILD] Failed to revert stuck graph metadata', { graphId: graph.graphId, error });
    }
  }

  logger.info(
    `[GRAPH-BUILD] Stalled-job recovery: marked ${runsFailed} build_runs as failed, reverted ${metadataReverted} graph_metadata rows`
  );

  return { runsFailed, metadataReverted };
}

/**
 * Register a continuous reconciler that re-sweeps stalled Postgres state whenever
 * the queue reports a `failed` or `stalled` job. This complements the
 * startup-time `recoverStalledJobs` for failures that happen while the worker is
 * up. The sweep is threshold-gated (see `recoverStalledJobs`), so a job BullMQ
 * may still retry is never prematurely failed. Idempotent — one listener per
 * process.
 */
export function registerStalledJobReconciler(queueName: string): void {
  if (reconciler) {
    return;
  }

  let connection;
  try {
    connection = getRedisClient();
  } catch {
    logger.warn('[GRAPH-BUILD] Redis not available — skipping stalled-job reconciler registration.');
    return;
  }

  reconciler = new QueueEvents(queueName, { connection });

  const reconcile = async (event: 'failed' | 'stalled', jobId: string): Promise<void> => {
    try {
      const { runsFailed, metadataReverted } = await recoverStalledJobs();
      if (runsFailed > 0 || metadataReverted > 0) {
        logger.info(
          `[GRAPH-BUILD] Reconciler (${event}, job ${jobId}): ${runsFailed} runs failed, ${metadataReverted} metadata reverted`
        );
      }
    } catch (error) {
      logger.error('[GRAPH-BUILD] Stalled-job reconciler sweep failed', { event, jobId, error });
    }
  };

  reconciler.on('failed', ({ jobId }) => {
    void reconcile('failed', jobId);
  });
  reconciler.on('stalled', ({ jobId }) => {
    void reconcile('stalled', jobId);
  });

  logger.info(`[GRAPH-BUILD] Stalled-job reconciler registered on queue ${queueName}`);
}
