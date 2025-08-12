import { z } from 'zod';
import { v4 } from 'uuid';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { AiResponse, ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import { MessageRole, ContextType, Citation } from '@/features/chat/types/message';
import {
  BadRequest,
  Forbidden,
  InternalServerError,
} from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import getChat from '@/features/chat/dal/getChat';
import createMessages, {
  CreateMessagesInput,
} from '@/features/chat/dal/createMessages';
import getMessages from '@/features/chat/dal/getMessages';
import {
  addArtifactInstructionsToMessage,
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
} from '@/features/chat/utils/artifactHelperFunctions';
import getContentFromKbs, {
  KbResults,
} from '@/features/chat/knowledge-bases/getContentFromKbs';
import { embedContent } from '@/features/shared/dal/document-upload/embedContent';
import getEmbeddings, { EmbeddingResult } from '@/features/chat/dal/getEmbeddings';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';

// This is the maximum number of messages that will be used to generate the completion
const MaxExistingMessages = -24;

const inputSchema = z.object({
  chatId: z.string().uuid(),
  customInstructions: z.string().optional(),
  knowledgeBaseIds: z.array(z.string().uuid()),
  documentLibraryEnabled: z.boolean(),
});

const outputSchema = z.object({
  chatId: z.string().uuid(),
  messages: z.array(
    z.object({
      id: z.string().uuid(),
      role: z.string(),
      content: z.string(),
      messagedAt: z.date(),
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
            sourceLabel: z.string(),
            citation: z.string(),
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
          createdAt: z.date(),
        })
      ),
    })
  ),
  failedKbs: z.array(z.string()).optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { chatId, documentLibraryEnabled } = input;

    const chat = await getChat(chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(
        `You do not have permission to use this chat: userId: ${ctx.userId}, chatId: ${chat.id}`
      );
      throw Forbidden('You do not have permission to use this chat');
    }

    if (!chat.modelId) {
      logger.error(`Model for chat has not been set: ${chat.id}`);
      throw BadRequest('Model for chat has not been set');
    }

    const messages = await getMessages(chat.id);

    const retryMessages: ChatCompletionMessage[] = messages
      .slice(MaxExistingMessages)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        citations: msg.citations,
        artifacts: msg.artifacts,
      }));

    const lastMessageIndex = retryMessages.length - 1;

    let message = retryMessages[lastMessageIndex].content;

    // Manage additional context and citations
    let documentLibraryCitations: Citation[] = [];
    if (documentLibraryEnabled) {
      const embeddedContent = await embedContent(ctx.userId, message);

      if (!embeddedContent.embeddings?.length) {
        ctx.logger.debug('There was a problem embedding the users query');
        throw InternalServerError('Something went wrong embedding your message. Please try again later');
      }

      // Since we don't chunk the query, there should only be one embedding
      const embeddedQuery = embeddedContent.embeddings[0].embedding;

      // Query the vector store
      const embeddingResult: EmbeddingResult[] = await getEmbeddings({ userId: ctx.userId, embeddedQuery });

      // Add citations
      embeddingResult.forEach((context) => documentLibraryCitations.push(context.citation));
    }

    let knowledgeBaseCitations: Citation[] = [];
    let failedKbs: string[] = [];
    const knowledgeBaseIds = input.knowledgeBaseIds;

    if (knowledgeBaseIds.length) {
      const kbResults: KbResults = await getContentFromKbs(ctx, { message, knowledgeBaseIds });
      knowledgeBaseCitations = kbResults.citations;
      failedKbs = kbResults.failedKbs;
    }

    const citations: Citation[] = [
      ...knowledgeBaseCitations,
      ...documentLibraryCitations,
    ];

    // Add (potentially) modified message to chat
    message = addContextToMessage(message, citations);

    // Custom instructions implies response regeneration
    if (input.customInstructions) {
      message += input.customInstructions;
    }

    retryMessages[lastMessageIndex].content = message;

    let assistantMessage: AiResponse;

    try {
      const ai = await ctx.ai.buildUserSource(chat.modelId);
      retryMessages[0].content = addArtifactInstructionsToMessage(messages[0].content);

      assistantMessage = await ai.source.chatCompletion(retryMessages, {
        model: ai.model.externalId,
        randomness: 0.2,
        repetitiveness: 0.5,
      });
    } catch (error) {
      ctx.logger.error('There was an error regenerating response', { error });
      return {
        chatId: chat.id,
        messages: [],
      };
    }

    const { artifacts, cleanedText } = extractArtifactsFromMessage(assistantMessage.text);
    assistantMessage.text = cleanedText;

    const chatMsgId = v4();
    addChatMessageIdToArtifacts(artifacts, chatMsgId);

    const createMsgInput: CreateMessagesInput = {
      chatId: chat.id,
      messages: [
        {
          id: chatMsgId,
          role: MessageRole.Assistant,
          content: assistantMessage.text,
          createdAt: new Date(),
          citations: citations,
          artifacts: artifacts,
        },
      ],
    };

    const createdMessages = await createMessages(createMsgInput);

    return {
      chatId: chat.id,
      messages: createdMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        messagedAt: message.createdAt,
        citations: message.citations,
        artifacts: message.artifacts,
      })),
      failedKbs,
    };
  });
