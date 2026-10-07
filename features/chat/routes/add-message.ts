import { z } from 'zod';
import { v4 } from 'uuid';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import { MessageRole, ContextType, DeepResearchStatus, AsyncChatStatus, Citation } from '@/features/chat/types/message';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import { storage } from '@/server/storage/redis';
import createMessages, {
  CreateMessagesInput,
} from '@/features/chat/dal/createMessages';
import createGraphSnapshot from '@/features/chat/dal/createGraphSnapshot';
import { addSystemInstructions } from '@/features/chat/utils/chatHelperFunctions';
import { getDeepResearchQueue } from '@/features/ai-provider/sources/deep-research/deepResearchQueue';
import { getChatQueue } from '@/features/chat/utils/worker/queue';
import {
  buildSystemContext,
  processKnowledgeBases,
  combineCitations,
} from '@/features/chat/utils/chatContextHelpers';
import getUserGraphDatabaseAccess from '@/features/shared/dal/getUserGraphDatabaseAccess';
import ensureAgentSession from '@/features/chat/utils/ensureAgentSession';
import { getAgentChatQueue } from '@/features/chat/utils/worker/agentQueue';
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
const maxExistingMessages = -24;

const inputSchema = z.object({
  chatId: z.string().uuid(),
  message: z.string(),
  knowledgeBaseIds: z.array(z.string().uuid()),
  documentIds: z.array(z.string().uuid()),
  deepResearchEnabled: z.boolean().optional().default(false),
  useGraph: z.boolean().optional().default(false),
  graphSnapshot: z
    .object({
      nodeIds: z.array(z.string()),
      documentIds: z.array(z.string()),
      positions: z
        .record(z.object({ x: z.number(), y: z.number() }))
        .optional(),
    })
    .optional(),
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
  failedKbs: z.array(z.string()).optional(),
  isDeepResearch: z.boolean().optional(),
  deepResearchJobId: z.string().optional(),
  isAsyncChat: z.boolean().optional(),
  asyncChatJobId: z.string().optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { chatId, deepResearchEnabled, knowledgeBaseIds, documentIds, useGraph } = input;

    // Log clear marker for debugging
    ctx.logger.info('[CHAT] ========================================');
    ctx.logger.info('[CHAT] === NEW CHAT MESSAGE SUBMITTED ===');
    ctx.logger.info('[CHAT] ========================================');
    ctx.logger.info(`[CHAT] User question: "${input.message.substring(0, 200)}${input.message.length > 200 ? '...' : ''}"`);
    ctx.logger.info(`[CHAT] Chat ID: ${chatId}, Documents: ${documentIds.length}, KBs: ${knowledgeBaseIds.length}, useGraph: ${useGraph}`);

    // Build system message context
    const systemContext = await buildSystemContext(ctx.userId, knowledgeBaseIds, documentIds);
    const { userKnowledgeBases, selectedKnowledgeBases, hasDocumentLibrary, documentsWithSelectionState } = systemContext;

    const chat = await getChat(chatId);

    if (ctx.userRole !== UserRole.Admin && chat.userId !== ctx.userId) {
      ctx.logger.error(
        `[CHAT] You do not have permission to use this chat: userId: ${ctx.userId}, chatId: ${chat.id}`
      );
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.ChatMessageFormSubmission,
        outcome: AuditRecordOutcome.Warn,
        description: `User attempted to submit a message in chat "${chat.id}" but lacked permission`,
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          chatId: chat.id,
        },
      });
      throw Forbidden('You do not have permission to use this chat');
    }

    await assertDocumentAccess(ctx, documentIds);
    const isChatOwner = chat.userId === ctx.userId;
    if (isChatOwner && input.graphSnapshot) {
      await assertDocumentAccess(ctx, input.graphSnapshot.documentIds);
    }
    // check if the modelId is set (skip for agent provider chats)
    if (!chat.modelId && !chat.agentProviderId) {
      ctx.logger.error(`[CHAT] Model for chat has not been set: ${chat.id}`);
      ctx.auditor.createAuditRecord({
        event: AuditRecordEvent.ChatMessageFormSubmission,
        outcome: AuditRecordOutcome.Error,
        description: `User failed to submit a message in chat "${chat.id}": model for chat has not been set`,
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          chatId: chat.id,
        },
      });
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

    // Process knowledge bases (always the same regardless of retrieval method)
    const kbResults = await processKnowledgeBases(ctx, message, knowledgeBaseIds);
    const failedKbs = kbResults.failedKbs;

    let documentLibraryCitations: Citation[] = [];

    // Log a warning if the user doesn't have graph access but requested it
    if (useGraph && documentIds.length > 0) {
      const hasGraphAccess = await getUserGraphDatabaseAccess(ctx.userId);
      if (!hasGraphAccess) {
        ctx.logger.warn(`[CHAT] User ${ctx.userId} attempted to use graph functionality without access`);
      }
    }

    // Combine citations for the placeholder message (worker will update with full citations)
    const citations = combineCitations(documentLibraryCitations, kbResults.citations);

    ctx.logger.info('[CHAT] Message prepared', {
      useGraph,
      messageLength: message.length,
    });

    ctx.logger.debug('[CHAT] LLM Input message', { message });

    messages.push({
      role: MessageRole.User,
      content: message,
    });

    let deepResearchJobId: string | undefined;
    let asyncChatJobId: string | undefined;
    let createdMessages: Awaited<ReturnType<typeof createMessages>> | undefined;
    let createdGraphSnapshot: Awaited<ReturnType<typeof createGraphSnapshot>> | undefined;
    let dispatchOutcome: AuditRecordOutcome = AuditRecordOutcome.Success;
    let dispatchFailureReason: string | undefined;

    const userMsgId = v4();
    const createMsgInput: CreateMessagesInput = {
      chatId: chat.id,
      messages: [
        {
          id: userMsgId,
          role: MessageRole.User,
          content: input.message, // Store unmodified user input in database so we don't persist added context in chat thread
          createdAt: now,
          documentIds, // Persist the documents the user attached to this turn
          citations: [], // No citations on user's messages
          artifacts: [], // No artifacts on user's messages
          followUpQuestions: [], // No follow up questions on user's messages
          deepResearch: false,
          asyncChatJobId: null,
          asyncChatStatus: null,
        },
      ],
    };

    // All regular chats are processed async via the worker to avoid gateway timeouts
    // on long-running completions (e.g. large artifact generation).
    // Deep research has its own dedicated path and is excluded here.
    const needsAsyncProcessing = !deepResearchEnabled;

    // Agent provider submission — DB-backed external agent via agentProviderId on chat
    if (chat.agentProviderId) {
      try {
        const agentProvider = await ctx.prisma.agentProvider.findFirst({
          where: { id: chat.agentProviderId, deletedAt: null },
        });

        if (!agentProvider) {
          throw new Error('Agent provider not found or has been deleted');
        }

        const sessionId = await ensureAgentSession(
          chat,
          input.message,
          agentProvider.endpoint,
          agentProvider.apiKey ?? undefined,
        );
        const agentJobId = v4();
        const agentMsgId = v4();

        await storage.hset(`chat-job:${agentJobId}`, {
          status: 'processing',
          progress: 'Contacting agent...',
          created: Date.now(),
        });

        createMsgInput.messages.push({
          id: agentMsgId,
          role: MessageRole.Assistant,
          content: '',
          createdAt: new Date(),
          citations: [],
          artifacts: [],
          followUpQuestions: [],
          deepResearch: false,
          asyncChatJobId: agentJobId,
          asyncChatStatus: AsyncChatStatus.PROCESSING,
        });

        const queue = getAgentChatQueue();
        if (!queue) {
          throw new Error('Agent chat queue is not available');
        }

        await queue.add('agent-chat-completion', {
          jobId: agentJobId,
          userId: ctx.userId,
          agentId: '',
          chatId: chat.id,
          messageId: agentMsgId,
          userMessage: input.message,
          sessionId,
          agentProviderId: chat.agentProviderId,
        }, { delay: 500 });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.logger.error('[CHAT] Failed to queue agent provider job', {
          chatId: chat.id,
          userId: ctx.userId,
          error: errorMessage,
        });
        dispatchOutcome = AuditRecordOutcome.Error;
        dispatchFailureReason = errorMessage;
      }

    // Async chat submission uses worker
    } else if (needsAsyncProcessing) {
      try {
        ctx.logger.info(`[CHAT] Starting async chat completion for user ${ctx.userId} with ${documentIds.length} documents and ${knowledgeBaseIds.length} KBs`);

        asyncChatJobId = v4();
        const chatMsgId = v4();

        ctx.logger.info(`[CHAT] Async chat job queued: ${asyncChatJobId}`);

        // Create initial Redis entry so polling doesn't get "Job not found" error
        await storage.hset(`chat-job:${asyncChatJobId}`, {
          status: 'processing',
          progress: 'Initializing...',
          created: Date.now(),
        });

        // Create placeholder message for async processing (worker will add citations when complete)
        createMsgInput.messages.push({
          id: chatMsgId,
          role: MessageRole.Assistant,
          content: '',
          createdAt: new Date(),
          citations: citations, // Include graph citations - worker will add document citations when processing completes
          artifacts: [],
          followUpQuestions: [],
          deepResearch: false,
          asyncChatJobId: asyncChatJobId,
          asyncChatStatus: AsyncChatStatus.PROCESSING,
        });

        // Save messages to DB before queuing so the worker is guaranteed to find the record
        createdMessages = await createMessages(createMsgInput);
        if (await isMemoryEnabled()) {
          void enqueueConversationGraphSync({
            chatId,
            messageIds: createdMessages.map(({ id }) => id),
          });
        }

        // Add new job to chat queue
        const queue = getChatQueue();
        if (!queue) {
          throw new Error('Chat queue is not available');
        }

        const useAgenticChat = await getUserAgenticChatAccess(ctx.userId);

        await queue.add('chat-completion', {
          jobId: asyncChatJobId,
          userId: ctx.userId,
          agentId: '', // Not applicable for chat
          chatId: chatId,
          messageId: chatMsgId,
          modelId: chat.modelId!,
          userMessage: message, // Message with context added
          originalUserMessage: input.message, // Original user message
          documentIds,
          knowledgeBaseIds,
          citations,
          deepResearchEnabled: false,
          useAgenticChat,
          useGraph,
          userGroupId: chat.userGroupId,
        }, { jobId: asyncChatJobId });
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';

        ctx.logger.error('[CHAT] Async chat failed:', {
          error: errorMessage,
          errorType: error?.constructor?.name,
          stack: error?.stack,
        });
        dispatchOutcome = AuditRecordOutcome.Error;
        dispatchFailureReason = errorMessage;
      }

    // Deep Research chat submission uses source.deepResearch
    } else {
      
      try {
        ctx.logger.info(`[CHAT] Starting deep research for user ${ctx.userId}`);

        let messageWithContext = message;
        messageWithContext += (citations.length ? `\nRelevant Context:\n${citations.map(citation => `${citation.sourceLabel}: ${citation.citation}`).join('\n')}` : '');
        messageWithContext += addSystemInstructions(
          messageWithContext,
          userKnowledgeBases,
          selectedKnowledgeBases,
          hasDocumentLibrary,
          documentsWithSelectionState
        );

        ctx.logger.info(`[CHAT] Research input includes - Documents: ${documentLibraryCitations.length} citations, KB: ${kbResults.citations.length} citations, Total length: ${messageWithContext.length}`);

        deepResearchJobId = v4();
        const chatMsgId = v4();

        ctx.logger.info(`[CHAT] Deep research job queued: ${deepResearchJobId}`);
        
        // Create placeholder message for deep research
        createMsgInput.messages.push({
          id: chatMsgId,
          role: MessageRole.Assistant,
          content: '',
          createdAt: new Date(),
          citations: citations,
          artifacts: [], // No artifacts yet - these come from the completed research
          followUpQuestions: [], // No follow-ups yet - these come from the completed research
          deepResearch: true,
          deepResearchJobId: deepResearchJobId,
          deepResearchStatus: DeepResearchStatus.PENDING,
          asyncChatJobId: null,
          asyncChatStatus: null,
        });

        // Add new job to deep research queue
        const queue = getDeepResearchQueue();
        if (!queue) {
          throw new Error('Deep research queue is not available');
        }

        await queue.add('deep-research', {
          jobId: deepResearchJobId,
          userId: ctx.userId,
          chatId: chatId,
          messageId: chatMsgId, 
          modelId: chat.modelId!,
          input: messageWithContext,
          instructions: 'You are a helpful research assistant.', // NOTE: how does this get used?
          maxToolCalls: 50,
          userGroupId: chat.userGroupId,
        }, {
          delay: 1000, // 1 second delay to ensure database transaction completes
        });
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        
        ctx.logger.error('[CHAT] Deep research failed:', {
          error: errorMessage,
          errorType: error?.constructor?.name,
          stack: error?.stack,
        });
        dispatchOutcome = AuditRecordOutcome.Error;
        dispatchFailureReason = errorMessage;
      }
    }

    if (!createdMessages) {
      createdMessages = await createMessages(createMsgInput);
      if (await isMemoryEnabled()) {
        void enqueueConversationGraphSync({
          chatId,
          messageIds: createdMessages.map(({ id }) => id),
        });
      }
    }

    ctx.auditor.createAuditRecord({
      event: AuditRecordEvent.ChatMessageFormSubmission,
      outcome: dispatchOutcome,
      description: dispatchOutcome === AuditRecordOutcome.Success
        ? `User submitted a message in chat "${chat.id}"`
        : `User submitted a message in chat "${chat.id}" but processing failed: ${dispatchFailureReason}`,
      metadata: {
        resourceType: AuditRecordResourceType.ChatMessage,
        resourceIds: [userMsgId],
        chatId: chat.id,
        chatMessageId: userMsgId,
      },
    });

    // Persist graph snapshot tied to the user's question, if the frontend captured one.
    // The frontend sends this for graph-mode questions asked with nodes on the canvas.
    if (isChatOwner && input.graphSnapshot && input.graphSnapshot.nodeIds.length > 0) {
      try {
        createdGraphSnapshot = await createGraphSnapshot({
          chatMessageId: userMsgId,
          nodeIds: input.graphSnapshot.nodeIds,
          documentIds: input.graphSnapshot.documentIds,
          positions: input.graphSnapshot.positions ?? null,
        });
      } catch (error) {
        ctx.logger.error('[CHAT] Failed to persist graph snapshot', {
          chatMessageId: userMsgId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

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
        graphSnapshot: message.role === MessageRole.User
          ? createdGraphSnapshot
          : null,
      })),
      failedKbs,
      isDeepResearch: deepResearchEnabled,
      deepResearchJobId,
      isAsyncChat: needsAsyncProcessing,
      asyncChatJobId,
    };
  });
