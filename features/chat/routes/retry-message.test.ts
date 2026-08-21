import { waitFor } from '@testing-library/react';

jest.mock('@/features/graph-database/sources/neo4j', () => {
  return {
    Neo4jSource: jest.fn().mockImplementation(() => ({
      __mocked: true,
    })),
  };
});

import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { MessageRole } from '@/features/chat/types/message';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import createMessages from '@/features/chat/dal/createMessages';
import getContentFromKbs from '@/features/chat/knowledge-bases/getContentFromKbs';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import { getDeepResearchQueue } from '@/features/ai-provider/sources/deep-research/deepResearchQueue';
import ensureAgentSession from '@/features/chat/utils/ensureAgentSession';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';

jest.mock('@/features/chat/dal/createMessages');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/getMessages');
jest.mock('@/features/chat/dal/getEmbeddingsForDocuments');
jest.mock('@/features/chat/knowledge-bases/getContentFromKbs');
jest.mock('@/features/shared/dal/document-library/upload/embedContent', () => ({
  embedContent: jest.fn(),
}));
jest.mock('@/features/ai-provider/sources/deep-research/deepResearchQueue');
jest.mock('@/features/chat/utils/ensureAgentSession');
jest.mock('@/features/settings/dal/agent-providers/getAgentProvider');
jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/features/graph-database/utils/worker/conversationGraphQueue', () => ({
  enqueueConversationGraphSync: jest.fn(),
}));
const mockAgentQueueAdd = jest.fn();
jest.mock('@/features/chat/utils/worker/agentQueue', () => ({
  getAgentChatQueue: jest.fn(() => ({
    add: mockAgentQueueAdd,
  })),
}));
const mockChatQueueAdd = jest.fn();
jest.mock('@/features/chat/utils/worker/queue', () => ({
  getChatQueue: jest.fn(() => ({
    add: mockChatQueueAdd,
  })),
}));
jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn(),
  },
}));

const mockGetContentFromKbs = getContentFromKbs as jest.Mock;

describe('retry-message', () => {
  const mockUserId = '570e3594-0ff3-475d-9ee0-4be261e6b8db';
  const mockChatId = 'fcc14cff-37ba-42bb-8d83-c5618d25acd3';
  const mockModelId = '552079c8-53aa-4614-92fb-8eb5780eea4e';
  const mockEmbeddedQuery = {
    embeddings: [{ embedding: [0.23432, -0.123894] }],
  };

  const mockRetrievedEmbeddings = [
    {
      id: '28927a2e-1356-4a75-a860-7f921176695e',
      content: 'These are embeddings retrieved from getEmbeddingsForDocuments',
      score: 0.52,
      citation: {
        documentLabel: 'test-document.pdf',
        documentId: '7212c3ef-b1dc-4eef-b031-8bfe3ef81432',
      },
    },
  ];

  const mockGetChatResolvedValue = {
    id: mockChatId,
    userId: mockUserId,
    modelId: mockModelId,
    promptId: null,
    agentProviderId: null,
    summary: 'Chat summary',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testDate = new Date();

  const mockGetMessagesResolvedValue = [
    {
      id: 'b96e13a2-08fb-4d9f-bdf7-4419ca5d42b5',
      chatId: mockChatId,
      role: MessageRole.User,
      content: 'What is the best color?',
      createdAt: new Date(),
      deepResearch: false,
      citations: [],
      artifacts: [
        {
          id: 'artifact-1',
          chatMessageId: 'b96e13a2-08fb-4d9f-bdf7-4419ca5d42b5',
          label: 'Image of a color wheel',
          content: 'base64encodedstring',
          fileExtension: '.png',
          createdAt: new Date(),
        },
      ],
    },
    {
      id: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: new Date(),
      deepResearch: false,
      citations: [],
      artifacts: [],
    },
  ];

  const mockCreateMessagesResolvedValueWithoutArtifacts = [
    {
      id: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: testDate,
      documentIds: [],
      deepResearch: false,
      citations: [],
      artifacts: [],
      followUps: [],
      userChoices: [],
    },
  ];

  const mockInput = {
    chatId: mockChatId,
    knowledgeBaseIds: [],
    documentIds: [],
  };

  const mockKbResults = {
    content: 'queried knowledge base',
    citations: [{
      knowledgeBaseId: '4ac37e8d-63e4-49a1-8f8e-6855b087904a',
      citation: 'Citation 1',
    }],
    failedKbs: ['4ac37e8d-63e4-49a1-8f8e-6855b087904a'],
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getChat as jest.Mock).mockResolvedValue(mockGetChatResolvedValue);
    (getMessages as jest.Mock).mockResolvedValue(mockGetMessagesResolvedValue);
    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);
    (embedContent as jest.Mock).mockReturnValue(mockEmbeddedQuery);
    (getEmbeddingsForDocuments as jest.Mock).mockReturnValue(mockRetrievedEmbeddings);
    (getDeepResearchQueue as jest.Mock).mockReturnValue({
      add: jest.fn().mockResolvedValue({}),
    });
    (ensureAgentSession as jest.Mock).mockResolvedValue(null);
    (getAgentProvider as jest.Mock).mockResolvedValue(null);
    mockChatQueueAdd.mockResolvedValue({});

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      logger: logger,
      getAccessibleDocIds: jest.fn().mockResolvedValue(
        { has: () => true } as unknown as import('@/features/shared/types/AccessibleDocIds').AccessibleDocIds,
      ),
    } as unknown as ContextType;

    mockGetContentFromKbs.mockResolvedValue(mockKbResults);
  });

  it('queues async chat-completion job for regular retry', async () => {
    const caller = chatRouter.createCaller(ctx);
    await caller.retryMessage(mockInput);

    expect(mockChatQueueAdd).toHaveBeenCalledWith(
      'chat-completion',
      expect.objectContaining({
        userId: mockUserId,
        chatId: mockChatId,
        modelId: mockModelId,
        deepResearchEnabled: false,
      }),
    );
  });

  it('returns placeholder message and queues async job for regular retry', async () => {
    const caller = chatRouter.createCaller(ctx);
    const result = await caller.retryMessage(mockInput);

    expect(result.chatId).toBe(mockChatId);
    expect(result.messages).toHaveLength(1);
    expect(createMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: mockChatId,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'assistant',
            content: '',
          }),
        ]),
      }),
    );
    expect(mockChatQueueAdd).toHaveBeenCalled();
  });

  describe('conversation graph enqueue', () => {
    it('enqueues persisted message ids after persistence when the toggle is on', async () => {
      (isMemoryEnabled as jest.Mock).mockResolvedValue(true);

      const caller = chatRouter.createCaller(ctx);
      await caller.retryMessage(mockInput);

      expect(enqueueConversationGraphSync).toHaveBeenCalledWith({
        chatId: mockChatId,
        messageIds: mockCreateMessagesResolvedValueWithoutArtifacts.map(({ id }) => id),
      });
      expect((createMessages as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        (enqueueConversationGraphSync as jest.Mock).mock.invocationCallOrder[0],
      );
    });

    it('does not enqueue when the toggle is off', async () => {
      (isMemoryEnabled as jest.Mock).mockResolvedValue(false);

      const caller = chatRouter.createCaller(ctx);
      await caller.retryMessage(mockInput);

      expect(enqueueConversationGraphSync).not.toHaveBeenCalled();
    });
  });

  it('appends custom instructions to the queued userMessage', async () => {
    const caller = chatRouter.createCaller(ctx);
    const customInstructions = 'Please be more concise';

    await caller.retryMessage({ ...mockInput, customInstructions });

    expect(mockChatQueueAdd).toHaveBeenCalledWith(
      'chat-completion',
      expect.objectContaining({
        userMessage: expect.stringContaining(customInstructions),
      }),
    );
  });

  it('throws error if user does not own chat and is not an admin', async () => {
    ctx.userId = '76073cf6-ce35-4146-a4b2-ed0132e5b7ae';

    const caller = chatRouter.createCaller(ctx);

    await expect(caller.retryMessage(mockInput)).rejects.toThrow('You do not have permission to use this chat');

    await waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  it('does not throw an error if user does not own chat but is an admin', async () => {
    ctx.userId = '76073cf6-ce35-4146-a4b2-ed0132e5b7ae';
    ctx.userRole = UserRole.Admin;

    const caller = chatRouter.createCaller(ctx);

    await expect(caller.retryMessage(mockInput)).resolves.not.toThrow();
  });

  it('throws error if the modelId is not set', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      ...mockGetChatResolvedValue,
      modelId: '',
    });

    const caller = chatRouter.createCaller(ctx);

    await expect(caller.retryMessage(mockInput)).rejects.toThrow('Model for chat has not been set');

    await waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  it('queries knowledge base if available', async () => {
    const caller = chatRouter.createCaller(ctx);

    const mockKnowledgeBaseIds = ['4ac37e8d-63e4-49a1-8f8e-6855b087904a'];

    await caller.retryMessage({ ...mockInput, knowledgeBaseIds: mockKnowledgeBaseIds });

    expect(getContentFromKbs).toHaveBeenCalledWith(ctx, expect.objectContaining({
      knowledgeBaseIds: mockKnowledgeBaseIds,
    }));
  });

  describe('Document Library Enabled', () => {
      it('should create user embeddings', async () => {
        const lastMessage = mockGetMessagesResolvedValue[
          mockGetMessagesResolvedValue.length - 1
        ];
        const caller = chatRouter.createCaller(ctx);

        await caller.retryMessage({ ...mockInput, documentIds: ['550e8400-e29b-41d4-a716-446655440000'] });

        // Attribution is asserted separately below; this covers only that the
        // user's query is what gets embedded, against no caller-resolved model.
        expect(embedContent).toHaveBeenCalledWith(
          lastMessage.content,
          ctx.userId,
          undefined,
          expect.any(Object),
        );
      });

      it('should attribute the query embedding to the assistant message it is retrieving for', async () => {
        const caller = chatRouter.createCaller(ctx);

        await caller.retryMessage({ ...mockInput, documentIds: ['550e8400-e29b-41d4-a716-446655440000'] });

        // The embedding happens before the message row exists, so it is charged to
        // the id that message will be created with — otherwise the spend is
        // unattributable and cannot be totalled toward the artifact it fed.
        const createdId = (createMessages as jest.Mock).mock.calls[0][0].messages[0].id;
        expect(embedContent).toHaveBeenCalledWith(
          expect.any(String),
          ctx.userId,
          undefined,
          { chatMessageId: createdId, stepLabel: 'query embedding' },
        );
      });

      it('should not create user embeddings if document library is not enabled', async () => {
        const caller = chatRouter.createCaller(ctx);

        await caller.retryMessage({ ...mockInput });

        expect(embedContent).not.toHaveBeenCalled();
      });

      it('should throw if embedding fails', async () => {
        (embedContent as jest.Mock).mockReturnValue({ embeddings: undefined });

        const caller = chatRouter.createCaller(ctx);

        await expect(caller.retryMessage({ ...mockInput, documentIds: ['550e8400-e29b-41d4-a716-446655440000'] })).rejects.toThrow(
          /wrong embedding your message/i
        );
      });

      it('should call getEmbeddingsForDocuments with embedded query when documentIds provided', async () => {
        const caller = chatRouter.createCaller(ctx);
        const documentIds = ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'];

        await caller.retryMessage({ ...mockInput, documentIds });

        expect(getEmbeddingsForDocuments).toHaveBeenCalledWith(expect.objectContaining({
          userId: ctx.userId,
          embeddedQuery: mockEmbeddedQuery.embeddings[0].embedding,
          documentIds,
        }));
      });
    });

  it('creates deep research job when deepResearch is true', async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    (getDeepResearchQueue as jest.Mock).mockReturnValue(mockQueue);

    const caller = chatRouter.createCaller(ctx);

    await caller.retryMessage({ ...mockInput, deepResearchEnabled: true });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'deep-research',
      expect.objectContaining({
        userId: ctx.userId,
        chatId: mockInput.chatId,
        modelId: mockModelId,
        maxToolCalls: 50,
      }),
      expect.objectContaining({
        delay: 1000,
      })
    );
  });

  describe('agent provider retry', () => {
    const mockAgentProviderId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const mockSessionId = 'test-session-id-abc123';
    const mockAgentProvider = {
      id: mockAgentProviderId,
      name: 'Test Agent',
      endpoint: 'https://agent.example.com',
      apiKey: 'test-api-key',
    };

    beforeEach(() => {
      (getChat as jest.Mock).mockResolvedValue({
        ...mockGetChatResolvedValue,
        modelId: null,
        agentProviderId: mockAgentProviderId,
        externalSessionId: null,
      });
      (getAgentProvider as jest.Mock).mockResolvedValue(mockAgentProvider);
      (ensureAgentSession as jest.Mock).mockResolvedValue(mockSessionId);
      (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);
    });

    it('queues agent retry job when chat has agentProviderId', async () => {
      const caller = chatRouter.createCaller(ctx);
      await caller.retryMessage(mockInput);

      expect(getAgentProvider).toHaveBeenCalledWith(mockAgentProviderId);
      expect(ensureAgentSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockChatId }),
        expect.any(String),
        mockAgentProvider.endpoint,
        mockAgentProvider.apiKey,
      );
      expect(mockAgentQueueAdd).toHaveBeenCalledWith(
        'agent-chat-completion',
        expect.objectContaining({
          chatId: mockChatId,
          agentProviderId: mockAgentProviderId,
          sessionId: mockSessionId,
        }),
        expect.any(Object),
      );
    });

    it('does not throw when chat has agentProviderId and no modelId', async () => {
      const caller = chatRouter.createCaller(ctx);
      await expect(caller.retryMessage(mockInput)).resolves.not.toThrow();
    });
  });
});
