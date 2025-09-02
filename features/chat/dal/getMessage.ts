import { Message, MessageRole, ContextType } from '@/features/chat/types/message';
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
            document: true,
          },
        },
        chatArtifacts: true,
        chatMessageFollowUp: true,
      },
    });
  } catch (error) {
    logger.error(
      `Error fetching message from the database: MessageId: ${messageId}`,
      error
    );
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
    citations: result.chatMessageCitations.map((citation) => {
      if (citation.knowledgeBaseId) {
        return {
          contextType: ContextType.KNOWLEDGE_BASE,
          knowledgeBaseId: citation.knowledgeBaseId,
          sourceLabel: citation.knowledgeBase!.label,
          citation: citation.citation,
        };
      } else {
        return {
          contextType: ContextType.DOCUMENT_LIBRARY,
          documentId: citation.documentId!,
          sourceLabel: citation.document!.filename,
          citation: citation.citation,
        };
      }
    }),
    artifacts: result.chatArtifacts.map((artifact) => ({
      id: artifact.id,
      fileExtension: artifact.fileExtension,
      label: artifact.label,
      content: artifact.content,
      chatMessageId: artifact.chatMessageId,
      createdAt: artifact.createdAt,
    })),
    followUps: result.chatMessageFollowUp.map((followUp) => ({
      id: followUp.id,
      chatMessageId: followUp.chatMessageId,
      content: followUp.content,
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
    })),
  };
}
