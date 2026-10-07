import logger from '@/server/logger';
import db from '@/server/db';

// Resolves the artifact to the user whose work produced it, so a non-Admin
// download request can be checked against that owner instead of the artifact
// itself — a chat artifact's owner is the chat's user, a workflow artifact's
// is the execution's triggering user.
export default async function getArtifactOwner(
  source: 'chat' | 'workflow',
  id: string,
): Promise<string | null> {
  try {
    if (source === 'chat') {
      const artifact = await db.chatArtifact.findUnique({
        where: { id },
        select: { message: { select: { chat: { select: { userId: true } } } } },
      });
      return artifact?.message.chat.userId ?? null;
    }

    const artifact = await db.workflowArtifact.findUnique({
      where: { id },
      select: { workflowExecution: { select: { triggeredBy: true } } },
    });
    return artifact?.workflowExecution.triggeredBy ?? null;
  } catch (error) {
    logger.error('Failed to resolve artifact owner', error);
    throw new Error('Unable to resolve artifact owner');
  }
}
