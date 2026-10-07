import logger from '@/server/logger';
import db from '@/server/db';

export type ArtifactContent = {
  label: string;
  fileExtension: string;
  content: string | null;
  binaryContent: string | null;
};

/**
 * Full content for a single chat/workflow artifact, for the context-studio
 * download action. This DAL itself has no owning-user check — the route
 * (get-artifact-content.ts) enforces that a non-Admin caller owns the
 * artifact or leads a group the owner belongs to before reaching here.
 * binaryContent is base64-encoded for JSON transport over tRPC.
 */
export default async function getArtifactContent(
  source: 'chat' | 'workflow',
  id: string,
): Promise<ArtifactContent | null> {
  try {
    if (source === 'chat') {
      const artifact = await db.chatArtifact.findUnique({
        where: { id },
        select: { label: true, fileExtension: true, content: true, binaryContent: true },
      });
      if (!artifact) { return null; }
      return {
        label: artifact.label,
        fileExtension: artifact.fileExtension,
        content: artifact.binaryContent ? null : artifact.content,
        binaryContent: artifact.binaryContent ? Buffer.from(artifact.binaryContent).toString('base64') : null,
      };
    }

    const artifact = await db.workflowArtifact.findUnique({
      where: { id },
      select: { label: true, fileExtension: true, content: true },
    });
    if (!artifact) { return null; }
    return {
      label: artifact.label,
      fileExtension: artifact.fileExtension,
      content: artifact.content,
      binaryContent: null,
    };
  } catch (error) {
    logger.error('Failed to fetch artifact content', error);
    throw new Error('Unable to fetch artifact content');
  }
}
