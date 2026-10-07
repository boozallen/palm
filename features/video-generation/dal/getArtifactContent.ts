import db from '@/server/db';

export async function getArtifactContent(artifactId: string, userId: string): Promise<string | null> {
  const chatArtifact = await db.chatArtifact.findFirst({
    where: {
      id: artifactId,
      message: { chat: { userId } },
    },
    select: { content: true },
  });
  if (chatArtifact) {
    return chatArtifact.content;
  }

  const workflowArtifact = await db.workflowArtifact.findFirst({
    where: {
      id: artifactId,
      workflowExecution: { triggeredBy: userId },
    },
    select: { content: true },
  });
  return workflowArtifact?.content ?? null;
}
