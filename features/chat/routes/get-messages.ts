import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import { ContextType } from '@/features/chat/types/message';

const inputSchema = z.object({
  chatId: z.string().uuid(),
});

const outputSchema = z.object({
  chatId: z.string().uuid(),
  messages: z.array(
    z.object({
      id: z.string().uuid(),
      role: z.string(),
      content: z.string(),
      messagedAt: z.date(),
      documentIds: z.array(z.string().uuid()),
      citations: z.array(
        z.discriminatedUnion('contextType', [
          z.object({
            contextType: z.literal(ContextType.KNOWLEDGE_BASE),
            knowledgeBaseId: z.string().uuid(),
            sourceLabel: z.string(),
            citation: z.string(),
          }),
          z.object({
            contextType: z.literal(ContextType.DOCUMENT_LIBRARY),
            documentId: z.string().uuid(),
            embeddingId: z.string().uuid().optional(),
            startPosition: z.number().optional(),
            endPosition: z.number().optional(),
            sourceLabel: z.string(),
            citation: z.string(),
          }),
          z.object({
            contextType: z.literal(ContextType.GRAPH_ENTITY),
            graphEntityId: z.string(),
            sourceLabel: z.string(),
            citation: z.string(),
            description: z.string().optional(),
            aliases: z.array(z.string()).optional(),
          }),
          z.object({
            contextType: z.literal(ContextType.GRAPH_CONCEPT),
            graphConceptId: z.string(),
            sourceLabel: z.string(),
            citation: z.string(),
            description: z.string().optional(),
            category: z.string().optional(),
          }),
        ])
      ),
      artifacts: z.array(
        z.object({
          id: z.string().uuid(),
          chatMessageId: z.string().uuid(),
          label: z.string(),
          content: z.string(),
          fileExtension: z.string(),
          githubPagesUrl: z.string().nullable(),
          githubUrl: z.string().nullable().optional(),
          createdAt: z.date(),
        })
      ),
      followUps: z.array(
        z.object({
          id: z.string().uuid(),
          chatMessageId: z.string().uuid(),
          content: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
        })
      ),
      userChoices: z.array(
        z.object({
          id: z.string().uuid(),
          chatMessageId: z.string().uuid(),
          label: z.string(),
          value: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
        })
      ),
      deepResearch: z.boolean(),
      deepResearchJobId: z.string().nullable().optional(),
      deepResearchStatus: z.string().nullable().optional(),
      asyncChatJobId: z.string().nullable().optional(),
      asyncChatStatus: z.string().nullable().optional(),
      progressMessages: z.array(z.string()).nullable().optional(),
      graphSearchResult: z.unknown().nullable().optional(),
      graphSnapshot: z
        .object({
          id: z.string().uuid(),
          chatMessageId: z.string().uuid(),
          nodeIds: z.array(z.string()),
          documentIds: z.array(z.string()),
          positions: z
            .record(z.object({ x: z.number(), y: z.number() }))
            .nullable()
            .optional(),
          createdAt: z.date(),
        })
        .nullable()
        .optional(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { chatId } = input;

    const chat = await getChat(chatId);

    // perform an ownership check with the user's id
    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(
        `You do not have permission to view messages from this chat: userId: ${ctx.userId}, chatId: ${chat.id}`
      );
      throw new Error(
        'You do not have permission to view messages from this chat'
      );
    }

    const messages = await getMessages(chatId);
    return {
      chatId,
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messagedAt: msg.createdAt,
        documentIds: msg.documentIds,
        citations: msg.citations,
        artifacts: msg.artifacts,
        followUps: msg.followUps,
        userChoices: msg.userChoices,
        deepResearch: msg.deepResearch,
        deepResearchJobId: msg.deepResearchJobId,
        deepResearchStatus: msg.deepResearchStatus,
        asyncChatJobId: msg.asyncChatJobId,
        asyncChatStatus: msg.asyncChatStatus,
        progressMessages: msg.progressMessages as string[] | null | undefined,
        graphSearchResult: msg.graphSearchResult,
        graphSnapshot: msg.graphSnapshot,
      })),
    };
  });
