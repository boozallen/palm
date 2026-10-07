import db from '@/server/db';
import logger from '@/server/logger';

type SaveWorkflowArtifactVersionInput = {
  artifactId: string;
  content: string;
  editedByUserId: string;
};

// Appends a version snapshot on each edit; seeds version 1 with the pre-edit content on first edit.
export default async function saveWorkflowArtifactVersion({
  artifactId,
  content,
  editedByUserId,
}: SaveWorkflowArtifactVersionInput): Promise<{ content: string; versionNumber: number }> {
  try {
    return await db.$transaction(async (tx) => {
      const artifact = await tx.workflowArtifact.findUnique({
        where: { id: artifactId },
        select: { content: true },
      });

      if (!artifact) {
        throw new Error('Artifact not found');
      }

      const latest = await tx.workflowArtifactVersion.findFirst({
        where: { workflowArtifactId: artifactId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      let nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

      // Seed history with the original content the first time an artifact is edited.
      if (!latest) {
        await tx.workflowArtifactVersion.create({
          data: {
            workflowArtifactId: artifactId,
            content: artifact.content,
            versionNumber: nextVersionNumber,
          },
        });
        nextVersionNumber += 1;
      }

      await tx.workflowArtifactVersion.create({
        data: {
          workflowArtifactId: artifactId,
          content,
          versionNumber: nextVersionNumber,
          editedByUserId,
        },
      });

      await tx.workflowArtifact.update({
        where: { id: artifactId },
        data: { content },
      });

      return { content, versionNumber: nextVersionNumber };
    });
  } catch (error) {
    logger.error(`Error saving workflow artifact version: ${artifactId}`, error);
    throw new Error('Error saving artifact version');
  }
}
