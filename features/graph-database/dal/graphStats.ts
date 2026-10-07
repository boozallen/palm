import { logger } from '@/server/logger';
import db from '@/server/db';
import type {
  GraphMetadataStats,
  GraphExtractionStats,
  GraphResolutionStats,
  ExtractionRunStats,
  ResolutionRunStats,
} from '@/features/graph-database/types';

/**
 * Get current stats for a graph
 */
export async function getGraphStats(graphId: string): Promise<GraphMetadataStats | null> {
  const metadata = await db.graphMetadata.findUnique({
    where: { graphId },
    select: { stats: true },
  });

  if (!metadata || !metadata.stats) {
    return null;
  }

  return metadata.stats as unknown as GraphMetadataStats;
}

/**
 * Initialize empty stats for a new graph
 */
function createEmptyStats(): GraphMetadataStats {
  return {
    extraction: {
      totalEntities: 0,
      totalConcepts: 0,
      totalChunks: 0,
      byDocument: {},
    },
    resolution: {
      totalIdentityEdges: 0,
      totalSimilarEdges: 0,
      totalCandidatesEvaluated: 0,
      documentPairsResolved: 0,
      lastRunAt: new Date().toISOString(),
    },
    transitivity: {
      totalViolationsFixed: 0,
      currentViolations: 0,
      lastCheckedAt: new Date().toISOString(),
    },
  };
}

/**
 * Update extraction stats after an extraction run
 */
export async function updateExtractionStats(
  graphId: string,
  runStats: ExtractionRunStats
): Promise<void> {
  try {
    const currentStats = (await getGraphStats(graphId)) || createEmptyStats();

    // Merge new extraction stats
    const newExtractionStats: GraphExtractionStats = {
      totalEntities: currentStats.extraction.totalEntities + runStats.entitiesCreated,
      totalConcepts: currentStats.extraction.totalConcepts + runStats.conceptsCreated,
      totalChunks: currentStats.extraction.totalChunks + runStats.chunksProcessed,
      byDocument: {
        ...currentStats.extraction.byDocument,
        ...runStats.byDocument,
      },
    };

    const updatedStats: GraphMetadataStats = {
      ...currentStats,
      extraction: newExtractionStats,
    };

    await db.graphMetadata.update({
      where: { graphId },
      data: {
        stats: updatedStats as object,
      },
    });

    logger.debug('[GRAPH-STATS] Updated extraction stats', {
      graphId,
      totalEntities: newExtractionStats.totalEntities,
      totalConcepts: newExtractionStats.totalConcepts,
    });
  } catch (error) {
    logger.error('[GRAPH-STATS] Failed to update extraction stats', {
      graphId,
      error: (error as Error).message,
    });
    throw new Error('Failed to update extraction stats');
  }
}

/**
 * Update resolution stats after a resolution run
 */
export async function updateResolutionStats(
  graphId: string,
  runStats: ResolutionRunStats
): Promise<void> {
  try {
    const currentStats = (await getGraphStats(graphId)) || createEmptyStats();

    // Update resolution stats
    const newResolutionStats: GraphResolutionStats = {
      totalIdentityEdges:
        currentStats.resolution.totalIdentityEdges + runStats.identityEdges,
      totalSimilarEdges:
        currentStats.resolution.totalSimilarEdges + runStats.similarEdges,
      totalCandidatesEvaluated:
        currentStats.resolution.totalCandidatesEvaluated + runStats.candidatesGenerated,
      documentPairsResolved:
        currentStats.resolution.documentPairsResolved + runStats.actualDocPairs,
      lastRunAt: new Date().toISOString(),
    };

    const updatedStats: GraphMetadataStats = {
      ...currentStats,
      resolution: newResolutionStats,
    };

    await db.graphMetadata.update({
      where: { graphId },
      data: {
        stats: updatedStats as object,
      },
    });

    logger.debug('[GRAPH-STATS] Updated resolution stats', {
      graphId,
      totalIdentityEdges: newResolutionStats.totalIdentityEdges,
      totalSimilarEdges: newResolutionStats.totalSimilarEdges,
      documentPairsResolved: newResolutionStats.documentPairsResolved,
    });
  } catch (error) {
    logger.error('[GRAPH-STATS] Failed to update resolution stats', {
      graphId,
      error: (error as Error).message,
    });
    throw new Error('Failed to update resolution stats');
  }
}

/**
 * Reset stats for a graph (used when graph is rebuilt from scratch)
 */
export async function resetGraphStats(graphId: string): Promise<void> {
  try {
    await db.graphMetadata.update({
      where: { graphId },
      data: {
        stats: createEmptyStats() as object,
      },
    });

    logger.info('[GRAPH-STATS] Reset stats', { graphId });
  } catch (error) {
    logger.error('[GRAPH-STATS] Failed to reset stats', {
      graphId,
      error: (error as Error).message,
    });
    throw new Error('Failed to reset graph stats');
  }
}

/**
 * Get a summary of graph health based on stats
 * Returns simple indicators for UI display
 */
export async function getGraphHealthSummary(graphId: string): Promise<{
  documentsExtracted: number;
  totalEntities: number;
  totalConcepts: number;
  identityEdges: number;
  similarEdges: number;
  currentViolations: number;
  lastUpdated: string | null;
} | null> {
  const stats = await getGraphStats(graphId);

  if (!stats) {
    return null;
  }

  return {
    documentsExtracted: Object.keys(stats.extraction.byDocument).length,
    totalEntities: stats.extraction.totalEntities,
    totalConcepts: stats.extraction.totalConcepts,
    identityEdges: stats.resolution.totalIdentityEdges,
    similarEdges: stats.resolution.totalSimilarEdges,
    currentViolations: stats.transitivity.currentViolations,
    lastUpdated: stats.resolution.lastRunAt || stats.transitivity.lastCheckedAt || null,
  };
}
