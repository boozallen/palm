import db from '@/server/db';
import logger from '@/server/logger';

export type ChatMetadata = {
  chatId: string,
  modelName: string | null,
  agentProviderName: string | null,
  messageCount: number,
  artifacts: { id: string, label: string, fileExtension: string }[],
}

export default async function getChatMetadata(userId: string, chatIds: string[]): Promise<ChatMetadata[]> {
  if (chatIds.length === 0) {
    return [];
  }

  let results = null;
  try {
    results = await db.chat.findMany({
      where: {
        id: { in: chatIds },
        userId,
      },
      select: {
        id: true,
        model: { select: { name: true } },
        agentProvider: { select: { name: true } },
        _count: { select: { messages: true } },
        messages: {
          select: {
            chatArtifacts: {
              select: { id: true, label: true, fileExtension: true },
            },
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching chat metadata from the database.', error);
    throw new Error('Error fetching chat metadata');
  }

  return results.map((chat) => ({
    chatId: chat.id,
    modelName: chat.model?.name ?? null,
    agentProviderName: chat.agentProvider?.name ?? null,
    messageCount: chat._count.messages,
    artifacts: chat.messages.flatMap((message) => message.chatArtifacts),
  }));
}
