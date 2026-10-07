import db from '@/server/db';
import logger from '@/server/logger';

export type WorkflowArtifactVersionSummary = {
  id: string;
  versionNumber: number;
  content: string;
  editedByUserId: string | null;
  createdAt: Date;
};

export default async function getWorkflowArtifactVersions(
  workflowArtifactId: string,
): Promise<WorkflowArtifactVersionSummary[]> {
  try {
    return await db.workflowArtifactVersion.findMany({
      where: { workflowArtifactId },
      orderBy: { versionNumber: 'asc' },
      select: {
        id: true,
        versionNumber: true,
        content: true,
        editedByUserId: true,
        createdAt: true,
      },
    });
  } catch (error) {
    logger.error(`Error fetching workflow artifact versions: ${workflowArtifactId}`, error);
    throw new Error('Error fetching artifact versions');
  }
}
