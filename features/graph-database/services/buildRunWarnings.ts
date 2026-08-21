import type {
  BuildRunWarning,
  ExtractionRunStats,
  ResolutionRunStats,
} from '@/features/graph-database/types';

// Threshold constants for warning generation
const THRESHOLDS = {
  // Resolution thresholds
  LOW_CONFIDENCE_IDENTITY_RATIO: 0.1, // Warn if >10% of IDENTITY edges have low confidence
  LOW_CONFIDENCE_VALUE: 0.8, // Confidence < 0.8 is considered low
  HIGH_UNRELATED_RATIO: 0.5, // Warn if >50% of candidates are unrelated

  // Extraction thresholds
  LOW_ENTITY_PER_CHUNK: 0.5, // Warn if <0.5 entities per chunk on average
};

/**
 * Generate warnings for extraction run stats
 */
export function generateExtractionWarnings(stats: ExtractionRunStats): BuildRunWarning[] {
  const warnings: BuildRunWarning[] = [];

  // Check for no entities extracted
  if (stats.entitiesCreated === 0 && stats.chunksProcessed > 0) {
    warnings.push({
      code: 'NO_ENTITIES_EXTRACTED',
      severity: 'error',
      message: 'No entities extracted from document - extraction may have failed',
      details: {
        chunksProcessed: stats.chunksProcessed,
        entitiesCreated: 0,
      },
    });
  }

  // Check for low entity density
  if (stats.chunksProcessed > 0 && stats.entitiesCreated > 0) {
    const entityDensity = stats.entitiesCreated / stats.chunksProcessed;
    if (entityDensity < THRESHOLDS.LOW_ENTITY_PER_CHUNK) {
      warnings.push({
        code: 'LOW_ENTITY_COUNT',
        severity: 'info',
        message: 'Low entity density - document may have little extractable content',
        details: {
          entityDensity: Number(entityDensity.toFixed(2)),
          chunksProcessed: stats.chunksProcessed,
          entitiesCreated: stats.entitiesCreated,
        },
      });
    }
  }

  // Check per-document for empty extractions
  for (const [docId, docStats] of Object.entries(stats.byDocument)) {
    if (docStats.entities === 0 && docStats.chunks > 0) {
      warnings.push({
        code: 'NO_ENTITIES_EXTRACTED',
        severity: 'warning',
        message: `No entities extracted from document ${docId.substring(0, 8)}`,
        details: {
          documentId: docId,
          chunks: docStats.chunks,
        },
      });
    }
  }

  // Check for chunks skipped after repeated extraction failures (resumable path)
  const skippedChunkIds = stats.skippedChunkIds ?? [];
  if (skippedChunkIds.length > 0) {
    warnings.push({
      code: 'CHUNKS_SKIPPED',
      severity: 'warning',
      message: `${skippedChunkIds.length} chunk(s) failed extraction after retries and were skipped`,
      details: {
        count: skippedChunkIds.length,
        chunkIds: skippedChunkIds,
      },
    });
  }

  return warnings;
}

/**
 * Generate warnings for resolution run stats
 */
export function generateResolutionWarnings(stats: ResolutionRunStats): BuildRunWarning[] {
  const warnings: BuildRunWarning[] = [];

  // Check for doc pair mismatch
  if (stats.expectedDocPairs > 0 && stats.actualDocPairs !== stats.expectedDocPairs) {
    warnings.push({
      code: 'DOC_PAIR_MISMATCH',
      severity: 'error',
      message: 'Resolved more/fewer doc pairs than expected - possible re-resolution bug',
      details: {
        expectedDocPairs: stats.expectedDocPairs,
        actualDocPairs: stats.actualDocPairs,
        difference: stats.actualDocPairs - stats.expectedDocPairs,
      },
    });
  }

  // Check for duplicate resolutions
  if (stats.duplicateResolutions > 0) {
    warnings.push({
      code: 'DUPLICATE_RESOLUTIONS',
      severity: 'error',
      message: 'Same entity pair resolved multiple times',
      details: {
        duplicateCount: stats.duplicateResolutions,
      },
    });
  }

  // Check for low confidence IDENTITY edges
  if (stats.identityEdges > 0) {
    const lowConfidenceRatio = stats.lowConfidenceIdentityCount / stats.identityEdges;
    if (lowConfidenceRatio > THRESHOLDS.LOW_CONFIDENCE_IDENTITY_RATIO) {
      warnings.push({
        code: 'LOW_CONFIDENCE_IDENTITY',
        severity: 'warning',
        message: 'Many IDENTITY edges have low confidence - review LLM prompt',
        details: {
          lowConfidenceCount: stats.lowConfidenceIdentityCount,
          totalIdentityEdges: stats.identityEdges,
          ratio: Number(lowConfidenceRatio.toFixed(2)),
          avgConfidence: stats.avgConfidence,
          minConfidence: stats.minConfidence,
        },
      });
    }
  }

  // Check for all same decision
  const { decisionBreakdown } = stats;
  const totalDecisions =
    decisionBreakdown.identity +
    decisionBreakdown.similar +
    decisionBreakdown.related +
    decisionBreakdown.unrelated;

  if (totalDecisions > 5) {
    // Only check if we have meaningful sample size
    const allIdentity = decisionBreakdown.identity === totalDecisions;
    const allSimilar = decisionBreakdown.similar === totalDecisions;
    const allRelated = decisionBreakdown.related === totalDecisions;
    const allUnrelated = decisionBreakdown.unrelated === totalDecisions;

    if (allIdentity || allSimilar || allRelated || allUnrelated) {
      const decisionType = allIdentity
        ? 'IDENTITY'
        : allSimilar
          ? 'SIMILAR'
          : allRelated
            ? 'RELATED'
            : 'UNRELATED';

      warnings.push({
        code: 'ALL_SAME_DECISION',
        severity: 'warning',
        message: `All candidates got same decision (${decisionType}) - possible LLM issue`,
        details: {
          decisionType,
          totalDecisions,
          breakdown: decisionBreakdown,
        },
      });
    }
  }

  // Check for high unrelated ratio
  if (totalDecisions > 0) {
    const unrelatedRatio = decisionBreakdown.unrelated / totalDecisions;
    if (unrelatedRatio > THRESHOLDS.HIGH_UNRELATED_RATIO) {
      warnings.push({
        code: 'HIGH_UNRELATED_RATIO',
        severity: 'info',
        message: 'High unrelated ratio - candidate generation may be too broad',
        details: {
          unrelatedCount: decisionBreakdown.unrelated,
          totalDecisions,
          ratio: Number(unrelatedRatio.toFixed(2)),
        },
      });
    }
  }

  return warnings;
}

