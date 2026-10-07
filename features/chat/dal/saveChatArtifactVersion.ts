import db from '@/server/db';
import logger from '@/server/logger';

type SaveChatArtifactVersionInput = {
  artifactId: string;
  content: string;
  editedByUserId: string;
};

// Appends a version snapshot on each edit; seeds version 1 with the pre-edit content on first edit.
export default async function saveChatArtifactVersion({
  artifactId,
  content,
  editedByUserId,
}: SaveChatArtifactVersionInput): Promise<{ content: string; versionNumber: number }> {
  try {
    return await db.$transaction(async (tx) => {
      const artifact = await tx.chatArtifact.findUnique({
        where: { id: artifactId },
        select: { content: true },
      });

      if (!artifact) {
        throw new Error('Artifact not found');
      }

      const latest = await tx.chatArtifactVersion.findFirst({
        where: { chatArtifactId: artifactId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      let nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

      // Seed history with the original content the first time an artifact is edited.
      if (!latest) {
        await tx.chatArtifactVersion.create({
          data: {
            chatArtifactId: artifactId,
            content: artifact.content,
            versionNumber: nextVersionNumber,
          },
        });
        nextVersionNumber += 1;
      }

      await tx.chatArtifactVersion.create({
        data: {
          chatArtifactId: artifactId,
          content,
          versionNumber: nextVersionNumber,
          editedByUserId,
        },
      });

      await tx.chatArtifact.update({
        where: { id: artifactId },
        data: { content },
      });

      return { content, versionNumber: nextVersionNumber };
    });
  } catch (error) {
    logger.error(`Error saving chat artifact version: ${artifactId}`, error);
    throw new Error('Error saving artifact version');
  }
}
