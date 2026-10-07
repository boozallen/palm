import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateWorkflowArtifactGithubPagesUrl(
  artifactId: string,
  githubPagesUrl: string,
): Promise<void> {
  try {
    await db.workflowArtifact.update({
      where: { id: artifactId },
      data: { githubPagesUrl },
    });
  } catch (error) {
    logger.error(`Error updating githubPagesUrl for workflow artifact: ${artifactId}`, error);
    throw new Error('Error updating artifact GitHub Pages URL');
  }
}
