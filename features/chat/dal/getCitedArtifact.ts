import ownedArtifactWhere from '@/features/chat/dal/ownedArtifactWhere';
import db from '@/server/db';
import logger from '@/server/logger';

export type GetCitedArtifactInput = Readonly<{
  userId: string;
  artifactId: string;
}>;

export type CitedArtifact = {
  id: string;
  label: string;
  fileExtension: string;
  content: string;
  sourceScript: string | null;
  githubUrl: string | null;
  githubPagesUrl: string | null;
  createdAt: Date;
  chatMessageId: string;
};

export default async function getCitedArtifact({
  userId,
  artifactId,
}: GetCitedArtifactInput): Promise<CitedArtifact | null> {
  try {
    return await db.chatArtifact.findFirst({
      where: {
        id: artifactId,
        ...ownedArtifactWhere(userId),
      },
      select: {
        id: true,
        label: true,
        fileExtension: true,
        content: true,
        sourceScript: true,
        githubUrl: true,
        githubPagesUrl: true,
        createdAt: true,
        chatMessageId: true,
      },
    });
  } catch (error) {
    logger.error('Error fetching cited artifact', { userId, artifactId, error });
    throw new Error('Error fetching artifact');
  }
}
