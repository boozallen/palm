import { logger } from '@/server/logger';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';

export type GraphMetadataResult = {
  graphId: string;
  userId: string;
  documentIds: string[];
  status: GraphBuildStatus;
  createdAt: Date;
  completedAt: Date | null;
  buildProgress: any;
  errorMessage: string | null;
};

/**
 * Get graph metadata by graphId
 * Returns null if not found
 */
export default async function getGraphMetadata(
  graphId: string,
  userId: string
): Promise<GraphMetadataResult | null> {
  try {
    const graphMetadata = await db.graphMetadata.findUnique({
      where: { graphId },
    });

    if (!graphMetadata) {
      logger.debug(`Graph metadata not found: ${graphId}`);
      return null;
    }

    // Verify ownership
    if (graphMetadata.userId !== userId) {
      logger.warn(`User ${userId} attempted to access graph ${graphId} owned by ${graphMetadata.userId}`);
      return null;
    }

    return {
      graphId: graphMetadata.graphId,
      userId: graphMetadata.userId,
      documentIds: graphMetadata.documentIds as string[],
      status: graphMetadata.status as GraphBuildStatus,
      createdAt: graphMetadata.createdAt,
      completedAt: graphMetadata.completedAt,
      buildProgress: graphMetadata.buildProgress,
      errorMessage: graphMetadata.errorMessage,
    };
  } catch (error) {
    logger.error(`Error fetching graph metadata ${graphId}:`, error);
    throw new Error('Failed to fetch graph metadata');
  }
}
