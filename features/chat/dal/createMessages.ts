import db from '@/server/db';
import logger from '@/server/logger';
import { Message, MessageRole, Artifact, ContextType, Citation, DeepResearchStatus, AsyncChatStatus } from '@/features/chat/types/message';

// This input accepts the IDs of the messages so that they will be known outside of the function
// This is being done because the prisma `createMany` function does not return the IDs of the created records
export type CreateMessagesInput = Readonly<{
  chatId: string;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    createdAt: Date;
    documentIds?: string[];
    citations: Citation[];
    artifacts: Artifact[];
    followUpQuestions: string[];
    deepResearch: boolean;
    deepResearchJobId?: string | null;
    deepResearchStatus?: DeepResearchStatus | null;
    asyncChatJobId?: string | null;
    asyncChatStatus?: AsyncChatStatus | null;
  }>;
}>;

export default async function createMessages(
  input: CreateMessagesInput
): Promise<Message[]> {
  try {
    await db.$transaction(async (prisma) => {
      // Create messages
      await prisma.chatMessage.createMany({
        data: input.messages.map((message) => ({
          id: message.id,
          chatId: input.chatId,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
          documentIds: message.documentIds ?? [],
          deepResearch: message.deepResearch,
          deepResearchJobId: message.deepResearchJobId,
          deepResearchStatus: message.deepResearchStatus,
          asyncChatJobId: message.asyncChatJobId,
          asyncChatStatus: message.asyncChatStatus,
        })),
      });

      // Create citations
      for (const message of input.messages) {
        if (message.citations.length > 0) {
          await prisma.chatMessageCitation.createMany({
            data: message.citations.map((citation) => {
              switch (citation.contextType) {
                case ContextType.DOCUMENT_LIBRARY:
                  return {
                    chatMessageId: message.id,
                    documentId: citation.documentId,
                    embeddingId: citation.embeddingId,
                    citation: citation.citation,
                  };
                case ContextType.KNOWLEDGE_BASE:
                  return {
                    chatMessageId: message.id,
                    knowledgeBaseId: citation.knowledgeBaseId,
                    citation: citation.citation,
                  };
                case ContextType.GRAPH_ENTITY:
                  return {
                    chatMessageId: message.id,
                    graphEntityId: citation.graphEntityId,
                    citation: citation.citation,
                  };
                case ContextType.GRAPH_CONCEPT:
                  return {
                    chatMessageId: message.id,
                    graphConceptId: citation.graphConceptId,
                    citation: citation.citation,
                  };
                case ContextType.PRIOR_CONVERSATION:
                  return {
                    chatMessageId: message.id,
                    citedMessageId: citation.citedMessageId,
                    citation: citation.citation,
                  };
                default:
                  throw new Error('Invalid context type provided');
              }
            }),
          });
        }
      }

      // Create artifacts
      for (const message of input.messages) {
        if (message.artifacts.length > 0) {
          await prisma.chatArtifact.createMany({
            data: message.artifacts.map((artifact) => ({
              id: artifact.id,
              fileExtension: artifact.fileExtension,
              label: artifact.label,
              content: artifact.content,
              chatMessageId: message.id,
              createdAt: artifact.createdAt,
            })),
          });
        }
      }

      // Create followUp questions
      for (const message of input.messages) {
        if (message.followUpQuestions.length) {
          await prisma.chatMessageFollowUp.createMany({
            data: message.followUpQuestions.map((question) => ({
              content: question,
              chatMessageId: message.id,
            })),
          });
        }
      }
    });

    // Fetch the newly created messages and their citations with knowledge base labels
    const newMessages = await db.chatMessage.findMany({
      where: {
        chatId: input.chatId,
        id: { in: input.messages.map((message) => message.id) }, // Use the IDs from the input
      },
      include: {
        chatMessageCitations: {
          include: {
            knowledgeBase: true, // Include the KnowledgeBase model to fetch the label
            document: true, // Include the Document model to fetch the title
            graphEntity: true, // Include the GraphEntityEmbedding model
            graphConcept: true, // Include the GraphConceptEmbedding model
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

    // Format the output according to CreateMessagesOutput type
    const output: Message[] = newMessages.map((message) => ({
      id: message.id,
      chatId: input.chatId,
      role: message.role as MessageRole,
      content: message.content,
      createdAt: message.createdAt,
      documentIds: message.documentIds,
      deepResearch: message.deepResearch,
      deepResearchJobId: message.deepResearchJobId,
      deepResearchStatus: message.deepResearchStatus as DeepResearchStatus | null,
      asyncChatJobId: message.asyncChatJobId,
      asyncChatStatus: message.asyncChatStatus as AsyncChatStatus | null,
      followUps: message.chatMessageFollowUp.map((followUp) => ({
        id: followUp.id,
        chatMessageId: followUp.chatMessageId,
        content: followUp.content,
        createdAt: followUp.createdAt,
        updatedAt: followUp.updatedAt,
      })),
      citations: message.chatMessageCitations.map((citation): Citation => {
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
      userChoices: [],
      artifacts: message.chatArtifacts.map((artifact) => ({
        id: artifact.id,
        fileExtension: artifact.fileExtension,
        label: artifact.label,
        content: artifact.content,
        chatMessageId: artifact.chatMessageId,
        githubPagesUrl: artifact.githubPagesUrl ?? null,
        githubUrl: artifact.githubUrl ?? null,
        createdAt: artifact.createdAt,
      })),
    }));

    return output;
  } catch (error) {
    logger.error(`Error creating messages: ChatId: ${input.chatId}`, error);
    throw new Error('Error creating messages');
  }
}
