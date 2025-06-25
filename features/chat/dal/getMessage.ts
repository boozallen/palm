import { Message, MessageRole } from '@/features/chat/types/message';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getMessage(messageId: string): Promise<Message> {
  let result = null;

  try {
    result = await db.chatMessage.findUnique({
      where: { id: messageId },
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
    logger.error(`Error fetching message from the database: MessageId: ${messageId}`, error);
    throw new Error('Error fetching message');
  }

  if (!result) {
    logger.error(`Message not found in database: MessageId: ${messageId}`);
    throw new Error('Message not found');
  }

  return {
    id: result.id,
    chatId: result.chatId,
    role: result.role as MessageRole,
    content: result.content,
    createdAt: result.createdAt,
    citations: result.chatMessageCitations.map(citation => ({
      knowledgeBaseId: citation.knowledgeBaseId,
      knowledgeBaseLabel: citation.knowledgeBase.label,
      citation: citation.citation,
    })),
    artifacts: result.chatArtifacts.map(artifact => ({
      id: artifact.id,
      fileExtension: artifact.fileExtension,
      label: artifact.label,
      content: artifact.content,
      chatMessageId: artifact.chatMessageId,
      createdAt: artifact.createdAt,
    })),
  };
}
