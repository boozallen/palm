import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateChatArtifactGithubPagesUrl(
  artifactId: string,
  githubPagesUrl: string,
): Promise<void> {
  try {
    await db.chatArtifact.update({
      where: { id: artifactId },
      data: { githubPagesUrl },
    });
  } catch (error) {
    logger.error(`Error updating githubPagesUrl for chat artifact: ${artifactId}`, error);
    throw new Error('Error updating artifact GitHub Pages URL');
  }
}
