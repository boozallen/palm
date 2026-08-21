import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { logger } from '@/server/logger';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';

export type CreateGraphMetadataParams = {
  userId: string;
  documentIds: string[];
};

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
 * Create or update graph metadata for a set of documents
 * Returns the graphId which is a hash of the sorted document IDs
 */
export default async function createGraphMetadata({
  userId,
  documentIds,
}: CreateGraphMetadataParams): Promise<GraphMetadataResult> {
  // Generate graph ID from sorted document IDs
  const sortedDocIds = [...documentIds].sort();
  const graphId = `graph_${userId}_${crypto
    .createHash('sha256')
    .update(sortedDocIds.join(','))
    .digest('hex')
    .substring(0, 16)}`;

  logger.info(`Creating/updating graph metadata: ${graphId} for user ${userId}`);

  try {
    const graphMetadata = await db.graphMetadata.upsert({
      where: { graphId },
      create: {
        graphId,
        userId,
        documentIds: sortedDocIds,
        status: GraphBuildStatus.Pending,
      },
      update: {
        status: GraphBuildStatus.Pending,
        documentIds: sortedDocIds,
        errorMessage: null,
        completedAt: null,
        buildProgress: Prisma.JsonNull,
      },
    });

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
    logger.error(`Error creating graph metadata for user ${userId}:`, error);
    throw new Error('Failed to create graph metadata');
  }
}
