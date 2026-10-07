import db from '@/server/db';
import logger from '@/server/logger';

export type ChatArtifactVersionSummary = {
  id: string;
  versionNumber: number;
  content: string;
  editedByUserId: string | null;
  createdAt: Date;
};

export default async function getChatArtifactVersions(
  chatArtifactId: string,
): Promise<ChatArtifactVersionSummary[]> {
  try {
    return await db.chatArtifactVersion.findMany({
      where: { chatArtifactId },
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
    logger.error(`Error fetching chat artifact versions: ${chatArtifactId}`, error);
    throw new Error('Error fetching artifact versions');
  }
}
