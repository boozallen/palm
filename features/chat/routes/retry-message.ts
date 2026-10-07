import { z } from 'zod';
import { v4 } from 'uuid';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import { MessageRole, ContextType, Citation, DeepResearchStatus, AsyncChatStatus } from '@/features/chat/types/message';
import { getDeepResearchQueue } from '@/features/ai-provider/sources/deep-research/deepResearchQueue';
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
import getContentFromKbs, {
  KbResults,
} from '@/features/chat/knowledge-bases/getContentFromKbs';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import { storage } from '@/server/storage/redis';
import ensureAgentSession from '@/features/chat/utils/ensureAgentSession';
import { getAgentChatQueue } from '@/features/chat/utils/worker/agentQueue';
import { getChatQueue } from '@/features/chat/utils/worker/queue';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';
import getUserAgenticChatAccess from '@/features/shared/dal/getUserAgenticChatAccess';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

// This is the maximum number of messages that will be used to generate the completion
const MaxExistingMessages = -24;

const inputSchema = z.object({
  chatId: z.string().uuid(),
  customInstructions: z.string().optional(),
  knowledgeBaseIds: z.array(z.string().uuid()),
  documentIds: z.array(z.string().uuid()),
  deepResearchEnabled: z.boolean().optional(),
  useGraph: z.boolean().optional().default(false),
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
            sectionPath: z.array(z.string()).optional(),
            pageStart: z.number().optional(),
            pageEnd: z.number().optional(),
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
          z.object({
            contextType: z.literal(ContextType.PRIOR_CONVERSATION),
            citation: z.string(),
            sourceLabel: z.string(),
            summary: z.string().optional(),
            citedMessageId: z.string(),
            chatId: z.string(),
            role: z.string().optional(),
            messageCreatedAt: z.union([z.date(), z.string()]).optional(),
            artifacts: z.array(z.object({
              id: z.string(),
              label: z.string(),
              fileExtension: z.string(),
              createdAt: z.union([z.date(), z.string()]),
            })).optional(),
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
    })
  ),
  failedKbs: z.array(z.string()).optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { chatId, deepResearchEnabled, documentIds, knowledgeBaseIds } = input;

    const chat = await getChat(chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      logger.error(
        `You do not have permission to use this chat: userId: ${ctx.userId}, chatId: ${chat.id}`
      );
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.ChatMessageRetry,
        outcome: AuditRecordOutcome.Warn,
        description: `User attempted to retry a message in chat "${chat.id}" but lacked permission`,
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          chatId: chat.id,
        },
      });
      throw Forbidden('You do not have permission to use this chat');
    }

    const accessibleDocIds = await assertDocumentAccess(ctx, documentIds);

    if (!chat.modelId && !chat.agentProviderId) {
      logger.error(`Model for chat has not been set: ${chat.id}`);
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.ChatMessageRetry,
        outcome: AuditRecordOutcome.Error,
        description: `User failed to retry a message in chat "${chat.id}": model for chat has not been set`,
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          chatId: chat.id,
        },
      });
      throw BadRequest('Model for chat has not been set');
    }

    const messages = await getMessages(chat.id);

    const retryMessages: ChatCompletionMessage[] = messages
      .filter((msg) => msg.asyncChatStatus !== AsyncChatStatus.ERROR)
      .slice(MaxExistingMessages)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        citations: msg.citations,
        artifacts: msg.artifacts,
      }));

    const lastMessageIndex = retryMessages.length - 1;

    let message = retryMessages[lastMessageIndex].content;
    const originalUserMessage = message;

    // The assistant message this retry produces, minted up front so the retrieval
    // embedding below can be charged to it. Every branch that follows is mutually
    // exclusive and creates exactly one assistant message, so a single id serves
    // all of them; ChatMessage carries no foreign key from AiProviderUsage, which
    // is what lets the usage row be written before the message row exists.
    const assistantMsgId = v4();

    // START: Manage additional context (document library files, knowledge bases) citations
    let documentLibraryCitations: Citation[] = [];
    if (documentIds.length) {
      const embeddedContent = await embedContent(message, ctx.userId, undefined, {
        chatMessageId: assistantMsgId,
        stepLabel: 'query embedding',
      });

      if (!embeddedContent.embeddings?.length) {
        ctx.logger.debug('There was a problem embedding the users query');
        ctx.auditor.createAuditRecord({
          event: AuditRecordEvent.ChatMessageRetry,
          outcome: AuditRecordOutcome.Error,
          description: `User failed to retry a message in chat "${chat.id}": query embedding failed`,
          metadata: {
            resourceType: AuditRecordResourceType.ChatMessage,
            resourceIds: [assistantMsgId],
            chatId: chat.id,
            chatMessageId: assistantMsgId,
          },
        });
        throw InternalServerError('Something went wrong embedding your message. Please try again later');
      }

      // Since we don't chunk the query, there should only be one embedding
      const embeddedQuery = embeddedContent.embeddings[0].embedding;

      // Query the vector store using specific document IDs
      const embeddingResult = await getEmbeddingsForDocuments({
        userId: ctx.userId,
        embeddedQuery,
        documentIds,
        accessibleDocIds,
      });
      ctx.logger.info(`Retrieved ${embeddingResult.length} document embeddings from specific documents`);

      documentLibraryCitations.push(...embeddingResult.map(context => context.citation));
    }

    let knowledgeBaseCitations: Citation[] = [];
    let failedKbs: string[] = [];

    if (knowledgeBaseIds.length) {
      const kbResults: KbResults = await getContentFromKbs(ctx, { message, knowledgeBaseIds });
      knowledgeBaseCitations = kbResults.citations;
      failedKbs = kbResults.failedKbs;
    }

    const citations: Citation[] = [
      ...knowledgeBaseCitations,
      ...documentLibraryCitations,
    ];

    message = addContextToMessage(message, citations);
    // END: Manage additional context (document library files, knowledge bases) citations

    // Add custom instructions directing LLM to regenerate response
    if (input.customInstructions) {
      message += input.customInstructions;
    }

    retryMessages[lastMessageIndex].content = message;

    let createMsgInput: CreateMessagesInput;
    let dispatchOutcome: AuditRecordOutcome = AuditRecordOutcome.Success;
    let dispatchFailureReason: string | undefined;

    // Agent provider regeneration — queues async job to avoid network timeout issues
    if (chat.agentProviderId) {
      try {
        const agentProvider = await getAgentProvider(chat.agentProviderId);
        const sessionId = await ensureAgentSession(chat, message, agentProvider.endpoint, agentProvider.apiKey ?? undefined);
        const agentJobId = v4();

        await storage.hset(`chat-job:${agentJobId}`, {
          status: 'processing',
          progress: 'Contacting agent...',
          created: Date.now(),
        });

        const queue = getAgentChatQueue();
        if (!queue) {
          throw new Error('Agent chat queue is not available');
        }

        await queue.add('agent-chat-completion', {
          jobId: agentJobId,
          userId: ctx.userId,
          agentId: '',
          agentProviderId: chat.agentProviderId,
          chatId: chat.id,
          messageId: assistantMsgId,
          userMessage: message,
          sessionId,
        }, { delay: 500 });

        createMsgInput = {
          chatId: chat.id,
          messages: [
            {
              id: assistantMsgId,
              role: MessageRole.Assistant,
              content: '',
              createdAt: new Date(),
              citations: [],
              artifacts: [],
              followUpQuestions: [],
              deepResearch: false,
              asyncChatJobId: agentJobId,
              asyncChatStatus: AsyncChatStatus.PROCESSING,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.logger.error('There was an error queuing agent regeneration job', { error });
        ctx.auditor.createAuditRecord({
          event: AuditRecordEvent.ChatMessageRetry,
          outcome: AuditRecordOutcome.Error,
          description: `User retried a message in chat "${chat.id}" but processing failed: ${errorMessage}`,
          metadata: {
            resourceType: AuditRecordResourceType.ChatMessage,
            resourceIds: [assistantMsgId],
            chatId: chat.id,
            chatMessageId: assistantMsgId,
          },
        });
        return {
          chatId: chat.id,
          messages: [] as z.infer<typeof outputSchema>['messages'],
        };
      }

    // Regular regeneration — queues async worker job to avoid network timeout issues
    } else if (!deepResearchEnabled) {
      const asyncChatJobId = v4();

      await storage.hset(`chat-job:${asyncChatJobId}`, {
        status: 'processing',
        progress: 'Initializing...',
        created: Date.now(),
      });

      createMsgInput = {
        chatId: chat.id,
        messages: [
          {
            id: assistantMsgId,
            role: MessageRole.Assistant,
            content: '',
            createdAt: new Date(),
            documentIds,
            citations: citations,
            artifacts: [],
            followUpQuestions: [],
            deepResearch: false,
            asyncChatJobId: asyncChatJobId,
            asyncChatStatus: AsyncChatStatus.PROCESSING,
          },
        ],
      };

      try {
        const queue = getChatQueue();
        if (!queue) {
          throw new Error('Chat queue is not available');
        }

        const createdMessages = await createMessages(createMsgInput);
        if (await isMemoryEnabled()) {
          void enqueueConversationGraphSync({
            chatId: chat.id,
            messageIds: createdMessages.map(({ id }) => id),
          });
        }

        const useAgenticChat = await getUserAgenticChatAccess(ctx.userId);

        await queue.add('chat-completion', {
          jobId: asyncChatJobId,
          userId: ctx.userId,
          agentId: '',
          chatId: chat.id,
          messageId: assistantMsgId,
          modelId: chat.modelId!,
          userMessage: message,
          originalUserMessage: originalUserMessage,
          documentIds,
          knowledgeBaseIds,
          citations,
          deepResearchEnabled: false,
          useAgenticChat,
          useGraph: input.useGraph,
          userGroupId: chat.userGroupId,
        });

        ctx.auditor.createAuditRecord({
          event: AuditRecordEvent.ChatMessageRetry,
          outcome: AuditRecordOutcome.Success,
          description: `User retried a message in chat "${chat.id}"`,
          metadata: {
            resourceType: AuditRecordResourceType.ChatMessage,
            resourceIds: [assistantMsgId],
            chatId: chat.id,
            chatMessageId: assistantMsgId,
          },
        });

        return {
          chatId: chat.id,
          messages: createdMessages.map((msg) => ({
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
          })),
          failedKbs,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.auditor.createAuditRecord({
          event: AuditRecordEvent.ChatMessageRetry,
          outcome: AuditRecordOutcome.Error,
          description: `User retried a message in chat "${chat.id}" but processing failed: ${errorMessage}`,
          metadata: {
            resourceType: AuditRecordResourceType.ChatMessage,
            resourceIds: [assistantMsgId],
            chatId: chat.id,
            chatMessageId: assistantMsgId,
          },
        });
        throw error;
      }

    // Deep Research regeneration uses source.deepResearch
    } else {
      const deepResearchJobId = v4();
      
      ctx.logger.info(`Starting deep research regeneration for user ${ctx.userId}`, { 
        userId: ctx.userId,
        chatId: chat.id,
        jobId: deepResearchJobId,
      });
      
      createMsgInput = {
        chatId: chat.id,
        messages: [
          {
            id: assistantMsgId,
            role: MessageRole.Assistant,
            content: '',
            createdAt: new Date(),
            documentIds,
            citations: citations,
            artifacts: [], // No artifacts yet - these come from the completed research
            followUpQuestions: [], // No follow-ups yet - these come from the completed research
            deepResearch: true,
            deepResearchJobId: deepResearchJobId,
            deepResearchStatus: DeepResearchStatus.PENDING,
          },
        ],
      };

      try {
        const queue = getDeepResearchQueue();
        if (!queue) {
          throw new Error('Deep research queue is not available');
        }

        await queue.add('deep-research', {
          jobId: deepResearchJobId,
          userId: ctx.userId,
          chatId: chatId,
          messageId: assistantMsgId,
          modelId: chat.modelId!,
          input: message,
          instructions: input.customInstructions || 'You are a helpful research assistant.',
          maxToolCalls: 50,
          userGroupId: chat.userGroupId,
        }, {
          jobId: deepResearchJobId,
          delay: 1000,
        });

        ctx.logger.info(`Deep research job queued: ${deepResearchJobId}`, { userId: ctx.userId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.logger.error('There was an error queuing deep research regeneration job', { error });
        dispatchOutcome = AuditRecordOutcome.Error;
        dispatchFailureReason = errorMessage;
      }
    }

    const createdMessages = await createMessages(createMsgInput);
    if (await isMemoryEnabled()) {
      void enqueueConversationGraphSync({
        chatId: chat.id,
        messageIds: createdMessages.map(({ id }) => id),
      });
    }

    ctx.auditor.createAuditRecord({
      event: AuditRecordEvent.ChatMessageRetry,
      outcome: dispatchOutcome,
      description: dispatchOutcome === AuditRecordOutcome.Success
        ? `User retried a message in chat "${chat.id}"`
        : `User retried a message in chat "${chat.id}" but processing failed: ${dispatchFailureReason}`,
      metadata: {
        resourceType: AuditRecordResourceType.ChatMessage,
        resourceIds: [assistantMsgId],
        chatId: chat.id,
        chatMessageId: assistantMsgId,
      },
    });

    return {
      chatId: chat.id,
      messages: createdMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        messagedAt: message.createdAt,
        documentIds: message.documentIds,
        citations: message.citations,
        artifacts: message.artifacts,
        followUps: message.followUps,
        userChoices: message.userChoices,
        deepResearch: message.deepResearch,
        deepResearchJobId: message.deepResearchJobId,
        deepResearchStatus: message.deepResearchStatus,
        asyncChatJobId: message.asyncChatJobId,
        asyncChatStatus: message.asyncChatStatus,
        progressMessages: null,
      })),
      failedKbs,
    };
  });
