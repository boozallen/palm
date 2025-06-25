import { Message, MessageRole } from '@/features/chat/types/message';
import logger from '@/server/logger';
import db from '@/server/db';

export default async function getMessages(chatId: string): Promise<Message[]> {
  let results = null;
  try {
    results = await db.chatMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      include: {
        chatMessageCitations: {
          include: {
            knowledgeBase: true,
          },
        },
        chatArtifacts: true,
      },
    });
  } catch (error) {
    logger.error(`Error fetching messages from the database. ChatId: ${chatId}`, error);
    throw new Error('Error fetching messages');
  }

  return results.map((msg): Message => ({
    id: msg.id,
    chatId: msg.chatId,
    role: msg.role as MessageRole,
    content: msg.content,
    createdAt: msg.createdAt,
    citations: msg.chatMessageCitations.map(citation => ({
      knowledgeBaseId: citation.knowledgeBaseId,
      knowledgeBaseLabel: citation.knowledgeBase.label,
      citation: citation.citation,
    })),
    artifacts: msg.chatArtifacts.map(artifact => ({
      id: artifact.id,
      fileExtension: artifact.fileExtension,
      label: artifact.label,
      content: artifact.content,
      chatMessageId: artifact.chatMessageId,
      createdAt: artifact.createdAt,
    })),
  }));
}
