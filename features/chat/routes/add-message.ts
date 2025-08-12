import { z } from 'zod';
import { v4 } from 'uuid';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import {
  AiResponse,
  ChatCompletionMessage,
} from '@/features/ai-provider/sources/types';
import { MessageRole, ContextType, Citation } from '@/features/chat/types/message';
import { Forbidden, InternalServerError } from '@/features/shared/errors/routeErrors';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import createMessages, {
  CreateMessagesInput,
} from '@/features/chat/dal/createMessages';
import getContentFromKbs, {
  KbResults,
} from '@/features/chat/knowledge-bases/getContentFromKbs';
import {
  addArtifactInstructionsToMessage,
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
} from '@/features/chat/utils/artifactHelperFunctions';
import { embedContent } from '@/features/shared/dal/document-upload/embedContent';
import getEmbeddings, { EmbeddingResult } from '@/features/chat/dal/getEmbeddings';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';

// This is the maximum number of messages that will be used to generate the completion
const maxExistingMessages = -24;

const inputSchema = z.object({
  chatId: z.string().uuid(),
  message: z.string(),
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

    let responseError = false;

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.logger.error(
        `You do not have permission to use this chat: userId: ${ctx.userId}, chatId: ${chat.id}`
      );
      throw Forbidden('You do not have permission to use this chat');
    }

    // check if the modelId is set
    if (!chat.modelId) {
      ctx.logger.error(`Model for chat has not been set: ${chat.id}`);
      throw new Error('Model for chat has not been set');
    }

    // This will be used for the message from the user.
    const now = new Date();

    const msgs = await getMessages(chat.id);

    // trim the existing messages to the maximum number of messages and map them to the ChatCompletionMessage type
    // TODO: the max messages should be configurable
    const messages: ChatCompletionMessage[] = msgs
      .slice(maxExistingMessages)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        artifacts: msg.artifacts,
      }));

    let message = input.message;

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

    messages.push({
      role: MessageRole.User,
      content: message,
    });

    let assistantMessage: AiResponse = {
      text: '',
      inputTokensUsed: 0,
      outputTokensUsed: 0,
    };

    try {
      const ai = await ctx.ai.buildUserSource(chat.modelId);
      messages[0].content = addArtifactInstructionsToMessage(
        messages[0].content
      );

      assistantMessage = await ai.source.chatCompletion(messages, {
        model: ai.model.externalId,
        randomness: 0.2,
        repetitiveness: 0.5,
      });
    } catch (error) {
      ctx.logger.error('Error building user source:', error);
      responseError = true;
    }

    const { artifacts, cleanedText } = extractArtifactsFromMessage(
      assistantMessage.text
    );
    assistantMessage.text = cleanedText;

    const createMsgInput: CreateMessagesInput = {
      chatId: chat.id,
      messages: [
        {
          id: v4(),
          role: MessageRole.User,
          content: input.message,
          createdAt: now,
          citations: [], // No citations on user's messages
          artifacts: [], // No artifacts on user's messages
        },
      ],
    };

    if (!responseError) {
      const chatMsgId = v4();
      addChatMessageIdToArtifacts(artifacts, chatMsgId);

      createMsgInput.messages.push({
        id: chatMsgId,
        role: MessageRole.Assistant,
        content: assistantMessage.text,
        createdAt: new Date(),
        citations: citations,
        artifacts: artifacts,
      });
    }

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
