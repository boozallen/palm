import db from '@/server/db';
import logger from '@/server/logger';

import { Message, MessageRole, Artifact } from '@/features/chat/types/message';

// This input accepts the IDs of the messages so that they will be known outside of the function
// This is being done because the prisma `createMany` function does not return the IDs of the created records
export type CreateMessagesInput = Readonly<{
  chatId: string;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    createdAt: Date;
    citations: Array<{
      knowledgeBaseId: string,
      citation: string,
    }>
    artifacts: Artifact[];
  }>;
}>;

export default async function createMessages(input: CreateMessagesInput): Promise<Message[]> {
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
        })),
      });

      // Create citations
      for (const message of input.messages) {
        if (message.citations.length > 0) {
          await prisma.chatMessageCitation.createMany({
            data: message.citations.map((citation) => ({
              chatMessageId: message.id,
              knowledgeBaseId: citation.knowledgeBaseId,
              citation: citation.citation,
            })),
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
    });

    // Fetch the newly created messages and their citations with knowledge base labels
    const newMessages = await db.chatMessage.findMany({
      where: {
        chatId: input.chatId,
        id: { in: input.messages.map(message => message.id) }, // Use the IDs from the input
      },
      include: {
        chatMessageCitations: {
          include: {
            knowledgeBase: true, // Include the KnowledgeBase model to fetch the label
          },
        },
        chatArtifacts: true,
      },
    });

    // Format the output according to CreateMessagesOutput type
    const output: Message[] =
      newMessages.map((message) => ({
        id: message.id,
        chatId: input.chatId,
        role: message.role as MessageRole,
        content: message.content,
        createdAt: message.createdAt,
        citations: message.chatMessageCitations.map((citation) => ({
          knowledgeBaseId: citation.knowledgeBaseId,
          knowledgeBaseLabel: citation.knowledgeBase.label, // Fetch the label from the included KnowledgeBase model
          citation: citation.citation,
        })),
        artifacts: message.chatArtifacts.map((artifact) => ({
          id: artifact.id,
          fileExtension: artifact.fileExtension,
          label: artifact.label,
          content: artifact.content,
          chatMessageId: artifact.chatMessageId,
          createdAt: artifact.createdAt,
        })),
      }));

    return output;
  } catch (error) {
    logger.error(`Error creating messages: ChatId: ${input.chatId}`, error);
    throw new Error('Error creating messages');
  }
}
