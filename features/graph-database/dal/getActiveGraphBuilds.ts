import { logger } from '@/server/logger';
import db from '@/server/db';
import { GraphBuildStatus } from '@/features/graph-database/types';

export type ActiveGraphBuild = {
  graphId: string;
  documentIds: string[];
  newDocumentIds?: string[];
  status: GraphBuildStatus;
  progress?: number;
  currentStep?: string;
  createdAt: Date;
  totalChunks?: number;
  processedChunks?: number;
};

// Client-side type after tRPC serialization (Date -> string)
export type ActiveGraphBuildClient = Omit<ActiveGraphBuild, 'createdAt'> & {
  createdAt: string;
};

/**
 * Get all active (building/pending/resolving) graph builds for a user
 */
export default async function getActiveGraphBuilds(userId: string): Promise<ActiveGraphBuild[]> {
  try {
    const activeBuilds = await db.graphMetadata.findMany({
      where: {
        userId,
        status: {
          in: [
            GraphBuildStatus.Pending,
            GraphBuildStatus.Building,
            GraphBuildStatus.Resolving,
            GraphBuildStatus.Cancelling,
          ],
        },
      },
      select: {
        graphId: true,
        documentIds: true,
        status: true,
        buildProgress: true,
        createdAt: true,
      },
    });

    return activeBuilds.map((build) => {
      let progress: number | undefined;
      let currentStep: string | undefined;
      let totalChunks: number | undefined;
      let processedChunks: number | undefined;
      let newDocumentIds: string[] | undefined;

      if (build.buildProgress) {
        const buildProgress = build.buildProgress as any;
        if (buildProgress.totalChunks && buildProgress.totalChunks > 0 && buildProgress.processedChunks !== undefined) {
          progress = Math.round((buildProgress.processedChunks / buildProgress.totalChunks) * 100);
        }
        currentStep = buildProgress.currentStep;
        totalChunks = buildProgress.totalChunks;
        processedChunks = buildProgress.processedChunks;
        newDocumentIds = buildProgress.newDocumentIds;
      }

      return {
        graphId: build.graphId,
        documentIds: build.documentIds as string[],
        newDocumentIds,
        status: build.status as GraphBuildStatus,
        progress,
        currentStep,
        createdAt: build.createdAt,
        totalChunks,
        processedChunks,
      };
    });
  } catch (error) {
    logger.error(`Error fetching active graph builds for user ${userId}:`, error);
    throw new Error('Failed to fetch active graph builds');
  }
}
