import { Message, MessageRole, ContextType, Citation } from '@/features/chat/types/message';
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
            embedding: {
              select: {
                startPosition: true,
                endPosition: true,
                sectionPath: true,
                pageStart: true,
                pageEnd: true,
              },
            },
            citedMessage: {
              select: {
                id: true,
                chatId: true,
                role: true,
                createdAt: true,
                chat: { select: { summary: true } },
                chatArtifacts: {
                  select: {
                    id: true,
                    label: true,
                    fileExtension: true,
                    createdAt: true,
                  },
                },
              },
            },
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
    documentIds: result.documentIds,
    deepResearch: result.deepResearch,
    citations: result.chatMessageCitations.map((citation): Citation => {
      if (citation.knowledgeBaseId) {
        return {
          contextType: ContextType.KNOWLEDGE_BASE,
          knowledgeBaseId: citation.knowledgeBaseId,
          sourceLabel: citation.knowledgeBase!.label,
          citation: citation.citation,
        };
      } else if (citation.citedMessageId && citation.citedMessage) {
        return {
          contextType: ContextType.PRIOR_CONVERSATION,
          citedMessageId: citation.citedMessage.id,
          chatId: citation.citedMessage.chatId,
          role: citation.citedMessage.role,
          messageCreatedAt: citation.citedMessage.createdAt,
          artifacts: citation.citedMessage.chatArtifacts,
          sourceLabel: citation.citedMessage.chat.summary || 'Prior conversation',
          citation: citation.citation,
        };
      } else {
        return {
          contextType: ContextType.DOCUMENT_LIBRARY,
          documentId: citation.documentId!,
          embeddingId: citation.embeddingId ?? undefined,
          sourceLabel: citation.document!.filename,
          citation: citation.citation,
          startPosition: citation.embedding?.startPosition ?? undefined,
          endPosition: citation.embedding?.endPosition ?? undefined,
          sectionPath: citation.embedding?.sectionPath ?? undefined,
          pageStart: citation.embedding?.pageStart ?? undefined,
          pageEnd: citation.embedding?.pageEnd ?? undefined,
        };
      }
    }),
    artifacts: result.chatArtifacts.map((artifact) => ({
      id: artifact.id,
      fileExtension: artifact.fileExtension,
      label: artifact.label,
      content: artifact.content,
      chatMessageId: artifact.chatMessageId,
      githubPagesUrl: artifact.githubPagesUrl ?? null,
      githubUrl: artifact.githubUrl ?? null,
      createdAt: artifact.createdAt,
    })),
    followUps: result.chatMessageFollowUp.map((followUp) => ({
      id: followUp.id,
      chatMessageId: followUp.chatMessageId,
      content: followUp.content,
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
    })),
    userChoices: [],
  };
}
