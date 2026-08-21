import { Message, MessageRole, ContextType, DeepResearchStatus, AsyncChatStatus, Citation, GraphSearchResultData } from '@/features/chat/types/message';
import { GraphSnapshot } from '@/features/chat/types/message';
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
            document: true,
            graphEntity: true,
            graphConcept: true,
            embedding: true,
          },
        },
        chatArtifacts: true,
        chatMessageFollowUp: true,
        chatMessageUserChoices: true,
        graphSearchResult: true,
        graphSnapshot: true,
      },
    });
  } catch (error) {
    logger.error(
      `Error fetching messages from the database. ChatId: ${chatId}`,
      error
    );
    throw new Error('Error fetching messages');
  }

  return results.map(
    (msg): Message => ({
      id: msg.id,
      chatId: msg.chatId,
      role: msg.role as MessageRole,
      content: msg.content,
      createdAt: msg.createdAt,
      documentIds: msg.documentIds,
      deepResearch: msg.deepResearch,
      deepResearchJobId: msg.deepResearchJobId,
      deepResearchStatus: msg.deepResearchStatus as DeepResearchStatus | null,
      asyncChatJobId: msg.asyncChatJobId,
      asyncChatStatus: msg.asyncChatStatus as AsyncChatStatus | null,
      progressMessages: msg.progressMessages as string[] | null,
      citations: msg.chatMessageCitations.map((citation): Citation => {
        if (citation.knowledgeBaseId) {
          return {
            contextType: ContextType.KNOWLEDGE_BASE,
            knowledgeBaseId: citation.knowledgeBaseId,
            sourceLabel: citation.knowledgeBase!.label,
            citation: citation.citation,
          };
        } else if (citation.graphEntityId) {
          return {
            contextType: ContextType.GRAPH_ENTITY,
            graphEntityId: citation.graphEntityId,
            sourceLabel: citation.graphEntity!.entityName,
            citation: citation.citation,
            description: citation.graphEntity!.description,
            aliases: citation.graphEntity!.aliases,
          };
        } else if (citation.graphConceptId) {
          return {
            contextType: ContextType.GRAPH_CONCEPT,
            graphConceptId: citation.graphConceptId,
            sourceLabel: citation.graphConcept!.conceptName,
            citation: citation.citation,
            description: citation.graphConcept!.description,
            category: citation.graphConcept!.category,
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
          };
        }
      }),
      artifacts: msg.chatArtifacts.map((artifact) => ({
        id: artifact.id,
        fileExtension: artifact.fileExtension,
        label: artifact.label,
        content: artifact.content,
        chatMessageId: artifact.chatMessageId,
        githubPagesUrl: artifact.githubPagesUrl ?? null,
        githubUrl: artifact.githubUrl ?? null,
        createdAt: artifact.createdAt,
      })),
      followUps: msg.chatMessageFollowUp.map((followUp) => ({
        id: followUp.id,
        chatMessageId: followUp.chatMessageId,
        content: followUp.content,
        createdAt: followUp.createdAt,
        updatedAt: followUp.updatedAt,
      })),
      userChoices: msg.chatMessageUserChoices.map((choice) => ({
        id: choice.id,
        chatMessageId: choice.chatMessageId,
        label: choice.label,
        value: choice.value,
        createdAt: choice.createdAt,
        updatedAt: choice.updatedAt,
      })),
      graphSearchResult: msg.graphSearchResult
        ? (Array.isArray(msg.graphSearchResult.data)
            ? (msg.graphSearchResult.data as GraphSearchResultData[])
            : [msg.graphSearchResult.data as GraphSearchResultData])
        : null,
      graphSnapshot: msg.graphSnapshot
        ? {
            id: msg.graphSnapshot.id,
            chatMessageId: msg.graphSnapshot.chatMessageId,
            nodeIds: msg.graphSnapshot.nodeIds,
            documentIds: msg.graphSnapshot.documentIds,
            positions: msg.graphSnapshot.positions as GraphSnapshot['positions'],
            createdAt: msg.graphSnapshot.createdAt,
          }
        : null,
    })
  );
}
