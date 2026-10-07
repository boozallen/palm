import { logger } from '@/server/logger';
import db from '@/server/db';
import type {
  CreateBuildRunParams,
  CompleteBuildRunParams,
  RunStats,
  BuildRunWarning,
  GraphBuildRunType,
  GraphBuildRunStatus,
} from '@/features/graph-database/types';

/**
 * Create a new graph build run record
 * Call this at the start of extraction/resolution/transitivity operations
 */
export async function createBuildRun(params: CreateBuildRunParams): Promise<string> {
  try {
    const run = await db.graphBuildRun.create({
      data: {
        graphId: params.graphId,
        userId: params.userId,
        runType: params.runType,
        documentIds: params.documentIds,
        isIncremental: params.isIncremental,
        newDocumentIds: params.newDocumentIds,
        existingDocumentIds: params.existingDocumentIds,
        status: 'running',
        stats: {},
        warnings: [],
      },
    });

    logger.info('[BUILD-RUNS] Created build run', {
      runId: run.id.substring(0, 8),
      graphId: params.graphId,
      runType: params.runType,
      isIncremental: params.isIncremental,
    });

    return run.id;
  } catch (error) {
    logger.error('[BUILD-RUNS] Failed to create build run', {
      graphId: params.graphId,
      runType: params.runType,
      error: (error as Error).message,
    });
    throw new Error('Failed to create build run');
  }
}

/**
 * Complete a build run with stats and warnings
 * Call this when the operation completes successfully
 */
export async function completeBuildRun(params: CompleteBuildRunParams): Promise<void> {
  try {
    const run = await db.graphBuildRun.findUnique({
      where: { id: params.runId },
      select: { startedAt: true },
    });

    if (!run) {
      throw new Error(`Build run not found: ${params.runId}`);
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - run.startedAt.getTime();

    await db.graphBuildRun.update({
      where: { id: params.runId },
      data: {
        status: 'completed',
        completedAt,
        durationMs,
        stats: params.stats as object,
        warnings: params.warnings as object[],
      },
    });

    logger.info('[BUILD-RUNS] Completed build run', {
      runId: params.runId.substring(0, 8),
      durationMs,
      warningsCount: params.warnings.length,
    });
  } catch (error) {
    logger.error('[BUILD-RUNS] Failed to complete build run', {
      runId: params.runId,
      error: (error as Error).message,
    });
    throw new Error('Failed to complete build run');
  }
}

/**
 * Mark a build run as failed
 * Call this when an error occurs during the operation
 */
export async function failBuildRun(
  runId: string,
  errorMessage: string,
  partialStats?: RunStats
): Promise<void> {
  try {
    const run = await db.graphBuildRun.findUnique({
      where: { id: runId },
      select: { startedAt: true },
    });

    const completedAt = new Date();
    const durationMs = run ? completedAt.getTime() - run.startedAt.getTime() : undefined;

    await db.graphBuildRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        completedAt,
        durationMs,
        errorMessage,
        stats: partialStats ? (partialStats as object) : undefined,
      },
    });

    logger.warn('[BUILD-RUNS] Failed build run', {
      runId: runId.substring(0, 8),
      errorMessage,
      durationMs,
    });
  } catch (error) {
    logger.error('[BUILD-RUNS] Failed to update failed build run', {
      runId,
      error: (error as Error).message,
    });
    // Don't throw - this is error handling code
  }
}

/**
 * Mark a build run as cancelled
 * Call this when a user cancels an in-progress build
 */
export async function cancelBuildRun(
  runId: string,
  partialStats?: RunStats
): Promise<void> {
  try {
    const run = await db.graphBuildRun.findUnique({
      where: { id: runId },
      select: { startedAt: true },
    });

    const completedAt = new Date();
    const durationMs = run ? completedAt.getTime() - run.startedAt.getTime() : undefined;

    await db.graphBuildRun.update({
      where: { id: runId },
      data: {
        status: 'cancelled',
        completedAt,
        durationMs,
        errorMessage: 'Build cancelled by user',
        stats: partialStats ? (partialStats as object) : undefined,
      },
    });

    logger.info('[BUILD-RUNS] Cancelled build run', {
      runId: runId.substring(0, 8),
      durationMs,
    });
  } catch (error) {
    logger.error('[BUILD-RUNS] Failed to update cancelled build run', {
      runId,
      error: (error as Error).message,
    });
    // Don't throw - this is error handling code
  }
}

/**
 * Sweep every still-`running` build run for a graph to `cancelled`. One call
 * catches both the extraction run and any resolution run opened inside
 * `runEntityResolution` (its runId is not threaded out to the processor).
 */
export async function cancelRunningBuildRunsForGraph(graphId: string): Promise<void> {
  try {
    await db.graphBuildRun.updateMany({
      where: { graphId, status: 'running' },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        errorMessage: 'Build cancelled by user',
      },
    });

    logger.info('[BUILD-RUNS] Swept running build runs to cancelled', { graphId });
  } catch (error) {
    logger.error('[BUILD-RUNS] Failed to sweep running build runs to cancelled', {
      graphId,
      error: (error as Error).message,
    });
    // Don't throw - this is error handling code
  }
}

/**
 * Get build runs for a graph, ordered by most recent first
 */
export async function getBuildRunsForGraph(
  graphId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  runType: string;
  isIncremental: boolean;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  status: string;
  stats: RunStats | null;
  warnings: BuildRunWarning[];
  errorMessage: string | null;
}>> {
  const runs = await db.graphBuildRun.findMany({
    where: { graphId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      runType: true,
      isIncremental: true,
      startedAt: true,
      completedAt: true,
      durationMs: true,
      status: true,
      stats: true,
      warnings: true,
      errorMessage: true,
    },
  });

  return runs.map((run) => ({
    ...run,
    stats: run.stats as unknown as RunStats | null,
    warnings: (run.warnings as unknown as BuildRunWarning[]) || [],
  }));
}

/**
 * Get the most recent build run of a specific type for a graph
 */
export async function getLatestBuildRun(
  graphId: string,
  runType: GraphBuildRunType
): Promise<{
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  status: GraphBuildRunStatus;
  stats: RunStats | null;
  warnings: BuildRunWarning[];
} | null> {
  const run = await db.graphBuildRun.findFirst({
    where: {
      graphId,
      runType,
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      durationMs: true,
      status: true,
      stats: true,
      warnings: true,
    },
  });

  if (!run) {
    return null;
  }

  return {
    ...run,
    status: run.status as GraphBuildRunStatus,
    stats: run.stats as unknown as RunStats | null,
    warnings: (run.warnings as unknown as BuildRunWarning[]) || [],
  };
}

/**
 * Get all runs for a user, ordered by most recent first
 * Useful for user-level audit view
 */
export async function getBuildRunsForUser(
  userId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  graphId: string;
  runType: string;
  isIncremental: boolean;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  warningsCount: number;
}>> {
  const runs = await db.graphBuildRun.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      graphId: true,
      runType: true,
      isIncremental: true,
      startedAt: true,
      completedAt: true,
      status: true,
      warnings: true,
    },
  });

  return runs.map((run) => ({
    id: run.id,
    graphId: run.graphId,
    runType: run.runType,
    isIncremental: run.isIncremental,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    status: run.status,
    warningsCount: Array.isArray(run.warnings) ? run.warnings.length : 0,
  }));
}

/**
 * Count runs with warnings above a certain threshold
 * Useful for monitoring graph health
 */
export async function countRunsWithWarnings(
  graphId: string,
  minWarnings: number = 1
): Promise<number> {
  // Prisma doesn't support array length filtering directly
  // So we fetch and filter in memory for small datasets
  const runs = await db.graphBuildRun.findMany({
    where: { graphId },
    select: { warnings: true },
  });

  return runs.filter(
    (run) => Array.isArray(run.warnings) && run.warnings.length >= minWarnings
  ).length;
}
