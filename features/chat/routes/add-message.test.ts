import { waitFor } from '@testing-library/react';

import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { ContextType as CitationContextType, MessageRole } from '@/features/chat/types/message';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import createMessages from '@/features/chat/dal/createMessages';
import createGraphSnapshot from '@/features/chat/dal/createGraphSnapshot';
import getContentFromKbs from '@/features/chat/knowledge-bases/getContentFromKbs';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import {
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
} from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import {
  extractFollowUpQuestionsFromMessage,
} from '@/features/chat/utils/followUpQuestionsHelpers';
import {
  addSystemInstructions,
} from '@/features/chat/utils/chatHelperFunctions';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import getUserKnowledgeBases from '@/features/shared/dal/getUserKnowledgeBases';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getDocuments from '@/features/shared/dal/document-library/upload/getDocuments';
import getBedrockModelAccess from '@/features/shared/dal/getBedrockModelAccess';
import { buildGraphContext } from '@/features/chat/dal/buildGraphContext';
import getUserGraphDatabaseAccess from '@/features/shared/dal/getUserGraphDatabaseAccess';
import assertDocumentAccess from '@/features/shared/utils/assertDocumentAccess';
import ensureAgentSession from '@/features/chat/utils/ensureAgentSession';
import db from '@/server/db';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

jest.mock('@/features/chat/dal/createMessages');
jest.mock('@/features/chat/dal/createGraphSnapshot');
jest.mock('@/features/chat/dal/buildGraphContext');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/getEmbeddingsForDocuments');
jest.mock('@/features/chat/dal/getMessages');
jest.mock('@/features/chat/knowledge-bases/getContentFromKbs');
jest.mock('@/features/chat/knowledge-bases/addContextToMessage');
jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions');
jest.mock('@/features/chat/utils/followUpQuestionsHelpers');
jest.mock('@/features/chat/utils/chatHelperFunctions');
jest.mock('@/features/shared/dal/document-library/upload/embedContent', () => ({
  embedContent: jest.fn(),
}));
jest.mock('@/features/shared/dal/getUserKnowledgeBases');
jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/features/shared/dal/document-library/upload/getDocuments');
jest.mock('@/features/shared/dal/getBedrockModelAccess');
jest.mock('@/features/shared/dal/getUserGraphDatabaseAccess');
jest.mock('@/features/shared/utils/assertDocumentAccess');
jest.mock('@/features/graph-database/index');
jest.mock('@/features/graph-database/services/graphQueries');
jest.mock('@/features/graph-database/sources/index');
jest.mock('@/features/graph-database/factory');
jest.mock('neo4j-driver', () => ({
  driver: jest.fn(),
  auth: {
    basic: jest.fn(),
  },
}), { virtual: true });
jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/features/graph-database/utils/worker/conversationGraphQueue', () => ({
  enqueueConversationGraphSync: jest.fn(),
}));
jest.mock('@/features/chat/dal/getEntitiesForQuery', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/chat/dal/getConceptsForQuery', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue([]),
}));
const mockAgentQueueAdd = jest.fn();
const mockAgentProviderFindFirst = jest.fn();
const mockQueueAdd = jest.fn();
jest.mock('@/features/chat/utils/worker/queue', () => ({
  getChatQueue: jest.fn(() => ({
    add: mockQueueAdd,
  })),
}));
jest.mock('@/features/chat/utils/worker/agentQueue', () => ({
  getAgentChatQueue: jest.fn(() => ({
    add: mockAgentQueueAdd,
  })),
}));
jest.mock('@/features/chat/utils/ensureAgentSession');
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));
jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn(),
  },
}));

jest.mock('@/features/graph-database/services/text2Cypher', () => ({
  text2CypherSearch: jest.fn().mockResolvedValue({
    query: 'test query',
    generatedCypher: 'MATCH (e:Entity) WHERE e.userId = $userId AND e.documentId IN $documentIds RETURN e',
    results: [],
    rowCount: 0,
    executionTimeMs: 50,
    queryType: 'explanation',
    suggestedFormat: 'prose',
  }),
}));

jest.mock('@/features/graph-database/services/graphQueries', () => ({
  getChunkSummaries: jest.fn().mockResolvedValue(new Map()),
}));

describe('add-message', () => {
  const mockUserId = '570e3594-0ff3-475d-9ee0-4be261e6b8db';
  const mockChatId = 'fcc14cff-37ba-42bb-8d83-c5618d25acd3';
  const mockMessage = 'What is the best color?';
  const mockModelId = '552079c8-53aa-4614-92fb-8eb5780eea4e';
  const mockModelExternalId = 'gpt-4o';
  const mockKnowledgeBaseIds = [
    'eb254f6b-5f3c-4fe8-a4d3-3de4bda7f723',
    '04118368-0222-4aba-8f4d-21eeaf7c5cad',
    'c3bcae58-84d6-4870-9948-bb2e55857980',
  ];

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
    userGroupId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGetMessagesResolvedValue = [
    {
      id: 'b96e13a2-08fb-4d9f-bdf7-4419ca5d42b5',
      chatId: mockChatId,
      role: MessageRole.User,
      content: 'What is the best color?',
      createdAt: new Date(),
    },
    {
      id: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: new Date(),
      deepResearch: false,
    },
  ];

  const mockAiResponse = {
    text: 'This is the AI response',
  };

  const mockArtifactContent = 'This is the AI response\n````artifact(".txt","artifact label")\nartifact content\n````';

  const _mockAiResponseWithArtifact = {
    text: mockArtifactContent,
  };

  const testDate = new Date();

  const mockExtractedArtifacts = [
    {
      id: 'd3b07384-d9f3-4f2e-8f3d-9e1e4bda7f72',
      label: 'artifact label',
      content: 'artifact content',
      fileExtension: '.txt',
      createdAt: testDate,
    },
  ];

  const mockCreateMessagesResolvedValueWithArtifacts = [
    {
      id: '6fd5972f-d199-4104-a5e9-dfb1641e49d8',
      chatId: mockChatId,
      role: MessageRole.User,
      content: mockMessage,
      createdAt: testDate,
      documentIds: [],
      citations: [],
      artifacts: [],
      followUps: [],
      userChoices: [],
      deepResearch: false,
    },
    {
      id: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: testDate,
      documentIds: [],
      citations: [],
      artifacts: [
        {
          id: 'd3b07384-d9f3-4f2e-8f3d-9e1e4bda7f72',
          chatMessageId: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
          label: 'artifact label',
          content: 'artifact content',
          fileExtension: '.txt',
          githubPagesUrl: null,
          createdAt: testDate,
        },
      ],
      followUps: [],
      userChoices: [],
      deepResearch: false,
    },
  ];

  const mockCreateMessagesResolvedValueWithoutArtifacts = [
    {
      id: '6fd5972f-d199-4104-a5e9-dfb1641e49d8',
      chatId: mockChatId,
      role: MessageRole.User,
      content: mockMessage,
      createdAt: testDate,
      documentIds: [],
      citations: [],
      artifacts: [],
      followUps: [],
      userChoices: [],
      deepResearch: false,
    },
    {
      id: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: testDate,
      documentIds: [],
      citations: [],
      artifacts: [],
      followUps: [],
      userChoices: [],
      deepResearch: false,
    },
  ];

  const mockInput = {
    chatId: mockChatId,
    message: mockMessage,
    knowledgeBaseIds: mockKnowledgeBaseIds,
    documentIds: [],
    deepResearchEnabled: false,
    useGraph: false,
  };

  const kbResultsMock = {
    citations: [{
      contextType: CitationContextType.KNOWLEDGE_BASE,
      sourceLabel: 'My knowledge base',
      knowledgeBaseId: 'knowledge-base-test-id',
      citation: 'This is test content',
    }],
    failedKbs: ['The Book of Colors', 'Full Spectrum'],
  };

  const kbEnhancedMessage = 'Message enhanced with kb';

  const mockUserKnowledgeBases = [
    {
      id: 'kb-1',
      name: 'Test KB 1',
      userId: mockUserId,
    },
    {
      id: 'kb-2',
      name: 'Test KB 2',
      userId: mockUserId,
    },
  ];

  const mockSystemConfig = {
    documentLibraryDocumentUploadProviderId: 'test-provider-id',
  };

  const mockUserDocuments = [
    {
      id: 'doc-1',
      name: 'Test Document 1',
      userId: mockUserId,
    },
    {
      id: 'doc-2',
      name: 'Test Document 2',
      userId: mockUserId,
    },
  ];

  const mockGraphContext = {
    entities: [
      {
        id: 'entity-1',
        entityName: 'GraphRAG',
        description: 'A graph-based retrieval augmented generation system',
        aliases: ['Graph RAG', 'Graph-RAG'],
        documentId: 'doc-123',
        score: 0.7028,
      },
    ],
    concepts: [
      {
        id: 'concept-1',
        conceptName: 'Knowledge Graph',
        description: 'A structured representation of entities and relationships',
        category: 'TECHNICAL',
        documentId: 'doc-123',
        score: 0.65,
      },
    ],
    relationships: [
      {
        source: 'GraphRAG',
        target: 'Knowledge Graph',
        type: 'USES',
        description: 'GraphRAG uses knowledge graphs for retrieval',
      },
    ],
  };

  const chatCompletion = jest.fn();
  const buildUserSource = jest.fn();

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockClear();
    (getChat as jest.Mock).mockResolvedValue(mockGetChatResolvedValue);
    (getMessages as jest.Mock).mockResolvedValue(mockGetMessagesResolvedValue);
    (addContextToMessage as jest.Mock).mockReturnValue(kbEnhancedMessage);
    (getContentFromKbs as jest.Mock).mockResolvedValue(kbResultsMock);

    (addSystemInstructions as jest.Mock).mockReturnValue('Message with custom instructions');
    (extractArtifactsFromMessage as jest.Mock).mockReturnValue({
      artifacts: mockExtractedArtifacts,
      cleanedText: 'This is the AI response',
    });
    (extractFollowUpQuestionsFromMessage as jest.Mock).mockReturnValue({
      followUpQuestions: [],
      deepResearch: false,
      cleanedText: 'This is the AI response',
    });
    (addChatMessageIdToArtifacts as jest.Mock).mockImplementation();
    (embedContent as jest.Mock).mockReturnValue(mockEmbeddedQuery);
    (getEmbeddingsForDocuments as jest.Mock).mockReturnValue(mockRetrievedEmbeddings);
    (getUserKnowledgeBases as jest.Mock).mockResolvedValue(mockUserKnowledgeBases);
    (getSystemConfig as jest.Mock).mockResolvedValue(mockSystemConfig);
    (getDocuments as jest.Mock).mockResolvedValue(mockUserDocuments);
    (getBedrockModelAccess as jest.Mock).mockResolvedValue(true);
    (getUserGraphDatabaseAccess as jest.Mock).mockResolvedValue(true);
    (db.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(0) }]);
    // By default, graph context build returns mock context
    (buildGraphContext as jest.Mock).mockResolvedValue(mockGraphContext);
    // Default createMessages mock - tests that need specific values can override
    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);
    (createGraphSnapshot as jest.Mock).mockResolvedValue(undefined);
    (assertDocumentAccess as jest.Mock).mockResolvedValue(undefined);

    chatCompletion.mockResolvedValue(mockAiResponse);

    buildUserSource.mockResolvedValue({
      source: {
        chatCompletion,
      },
      model: {
        externalId: mockModelExternalId,
      },
    });

    mockAgentProviderFindFirst.mockResolvedValue(null);
    (ensureAgentSession as jest.Mock).mockResolvedValue(null);

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      ai: {
        buildUserSource,
      },
      logger: logger,
      prisma: {
        agentProvider: {
          findFirst: mockAgentProviderFindFirst,
        },
      },
      getAccessibleDocIds: jest.fn().mockResolvedValue(
        // Tests don't care about access enforcement; return a set whose .has() always returns true.
        { has: () => true } as unknown as import('@/features/shared/types/AccessibleDocIds').AccessibleDocIds,
      ),
      auditor: {
        createAuditRecord: jest.fn(),
      },
    } as unknown as ContextType;
  });

  describe('conversation graph enqueue', () => {
    it('enqueues persisted message ids after persistence when the toggle is on', async () => {
      (isMemoryEnabled as jest.Mock).mockResolvedValue(true);

      const caller = chatRouter.createCaller(ctx);
      await caller.addMessage({ ...mockInput, knowledgeBaseIds: [], documentIds: [] });

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
      await caller.addMessage({ ...mockInput, knowledgeBaseIds: [], documentIds: [] });

      expect(enqueueConversationGraphSync).not.toHaveBeenCalled();
    });
  });

  describe('graph snapshots', () => {
    const graphSnapshot = {
      nodeIds: ['node-1', 'node-2'],
      documentIds: ['snapshot-doc-1', 'snapshot-doc-2'],
    };
    const createdGraphSnapshot = {
      id: '8e6ca252-9039-4d52-b54b-85f0ab18cc33',
      chatMessageId: '6fd5972f-d199-4104-a5e9-dfb1641e49d8',
      nodeIds: graphSnapshot.nodeIds,
      documentIds: graphSnapshot.documentIds,
      positions: null,
      createdAt: testDate,
    };

    it('checks snapshot document access, persists it, and returns it on the new user message', async () => {
      (createGraphSnapshot as jest.Mock).mockResolvedValueOnce(createdGraphSnapshot);

      const result = await chatRouter.createCaller(ctx).addMessage({
        ...mockInput,
        knowledgeBaseIds: [],
        graphSnapshot,
      });

      const createMessagesInput = (createMessages as jest.Mock).mock.calls[0][0];
      const newUserMessageId = createMessagesInput.messages.find(
        (message: { role: MessageRole }) => message.role === MessageRole.User,
      ).id;

      expect(assertDocumentAccess).toHaveBeenCalledWith(ctx, graphSnapshot.documentIds);
      expect(createGraphSnapshot).toHaveBeenCalledWith({
        chatMessageId: newUserMessageId,
        nodeIds: graphSnapshot.nodeIds,
        documentIds: graphSnapshot.documentIds,
        positions: null,
      });
      expect(result.messages.find(({ role }) => role === MessageRole.User)?.graphSnapshot)
        .toEqual(createdGraphSnapshot);
    });

    it('does not persist a snapshot when none is provided', async () => {
      await chatRouter.createCaller(ctx).addMessage({
        ...mockInput,
        knowledgeBaseIds: [],
      });

      expect(createGraphSnapshot).not.toHaveBeenCalled();
    });

    it('still succeeds when snapshot persistence fails', async () => {
      (createGraphSnapshot as jest.Mock).mockRejectedValueOnce(new Error('snapshot write failed'));

      await expect(chatRouter.createCaller(ctx).addMessage({
        ...mockInput,
        knowledgeBaseIds: [],
        graphSnapshot,
      })).resolves.toEqual(expect.objectContaining({ chatId: mockChatId }));
    });

    it('ignores a snapshot when an admin posts in another user\'s chat', async () => {
      ctx.userId = '2c2c52ff-f678-4dd1-95c1-a63fdb69f8b6';
      ctx.userRole = UserRole.Admin;

      await chatRouter.createCaller(ctx).addMessage({
        ...mockInput,
        knowledgeBaseIds: [],
        graphSnapshot,
      });

      expect(assertDocumentAccess).not.toHaveBeenCalledWith(ctx, graphSnapshot.documentIds);
      expect(createGraphSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('audit', () => {
    it('records a ChatMessageFormSubmission audit event referencing the chat', async () => {
      const caller = chatRouter.createCaller(ctx);
      await caller.addMessage(mockInput);

      expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditRecordEvent.ChatMessageFormSubmission,
          outcome: AuditRecordOutcome.Success,
          metadata: expect.objectContaining({
            resourceType: AuditRecordResourceType.ChatMessage,
            resourceIds: [expect.any(String)],
            chatId: mockChatId,
            chatMessageId: expect.any(String),
          }),
        }),
      );
    });
  });

  it('returns assistant message that contains artifacts', async () => {
    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithArtifacts);

    const caller = chatRouter.createCaller(ctx);
    const result = await caller.addMessage({ ...mockInput, knowledgeBaseIds: [], documentIds: [] });

    // Artifact extraction now happens in the worker, not the route
    expect(addSystemInstructions).not.toHaveBeenCalled();
    expect(extractArtifactsFromMessage).not.toHaveBeenCalled();
    expect(addChatMessageIdToArtifacts).not.toHaveBeenCalled();

    // Route queues async job and returns placeholder
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'chat-completion',
      expect.objectContaining({ chatId: mockChatId }),
      expect.objectContaining({ jobId: expect.any(String) }),
    );
    expect(result.isAsyncChat).toBe(true);
    expect(result.asyncChatJobId).toBeDefined();
  });

  it('carries the chat\'s selected user group onto the queued job', async () => {
    (getChat as jest.Mock).mockResolvedValue({ ...mockGetChatResolvedValue, userGroupId: 'group-1' });
    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithArtifacts);

    const caller = chatRouter.createCaller(ctx);
    await caller.addMessage({ ...mockInput, knowledgeBaseIds: [], documentIds: [] });

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'chat-completion',
      expect.objectContaining({ userGroupId: 'group-1' }),
      expect.objectContaining({ jobId: expect.any(String) }),
    );
  });

  it('returns assistant message that does not contain artifacts', async () => {
    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);

    const caller = chatRouter.createCaller(ctx);
    const result = await caller.addMessage({ ...mockInput, knowledgeBaseIds: [], documentIds: [] });

    // Artifact extraction now happens in the worker, not the route
    expect(addSystemInstructions).not.toHaveBeenCalled();
    expect(extractArtifactsFromMessage).not.toHaveBeenCalled();
    expect(addChatMessageIdToArtifacts).not.toHaveBeenCalled();

    // Route queues async job and returns placeholder
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'chat-completion',
      expect.objectContaining({ chatId: mockChatId }),
      expect.objectContaining({ jobId: expect.any(String) }),
    );
    expect(result.isAsyncChat).toBe(true);
    expect(result.asyncChatJobId).toBeDefined();
  });

  it('accepts prior-conversation citations in the output schema', async () => {
    const priorCitation = {
      contextType: CitationContextType.PRIOR_CONVERSATION,
      citedMessageId: 'cited-message-1',
      chatId: 'source-chat-1',
      role: 'assistant',
      messageCreatedAt: testDate,
      artifacts: [{
        id: 'artifact-1',
        label: 'Decision log',
        fileExtension: '.docx',
        createdAt: testDate,
      }],
      sourceLabel: 'Architecture decisions',
      citation: 'We chose pgvector.',
    };
    (createMessages as jest.Mock).mockResolvedValue(
      mockCreateMessagesResolvedValueWithoutArtifacts.map((message, index) =>
        index === 1 ? { ...message, citations: [priorCitation] } : message,
      ),
    );

    const result = await chatRouter.createCaller(ctx).addMessage({
      ...mockInput,
      knowledgeBaseIds: [],
      documentIds: [],
    });

    expect(result.messages[1].citations).toEqual([priorCitation]);
  });

  it('throws error if user does not own chat and is not an admin', async () => {
    ctx.userId = 'some-other-user-id';

    const caller = chatRouter.createCaller(ctx);

    await expect(caller.addMessage(mockInput)).rejects.toThrow('You do not have permission to use this chat');

    await waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  it('throws error if the modelId is not set', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      ...mockGetChatResolvedValue,
      modelId: '',
    });

    const caller = chatRouter.createCaller(ctx);

    await expect(caller.addMessage(mockInput)).rejects.toThrow('Model for chat has not been set');

    await waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  it('does call knowledge base functions and queues async job', async () => {
    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);

    const caller = chatRouter.createCaller(ctx);

    const result = await caller.addMessage(mockInput);

    // KB content fetching is still called in the route
    expect(getContentFromKbs).toHaveBeenCalledWith(ctx, {
      message: mockMessage,
      knowledgeBaseIds: mockKnowledgeBaseIds,
    });

    // addContextToMessage is NOT called in route when async processing
    // (it happens in the worker instead)
    expect(addContextToMessage).not.toHaveBeenCalled();

    // Async job should be queued
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'chat-completion',
      expect.objectContaining({
        chatId: mockChatId,
        knowledgeBaseIds: mockKnowledgeBaseIds,
        documentIds: [],
        useGraph: false,
      }),
      expect.objectContaining({ jobId: expect.any(String) }),
    );

    // Result should indicate async processing
    expect(result.isAsyncChat).toBe(true);
    expect(result.asyncChatJobId).toBeDefined();
  });

  describe('Document library async processing', () => {
    // Note: Embedding and document retrieval now happens in the async worker, not the route.
    // These tests verify that async jobs are queued correctly with documentIds.

    it('should queue async job when documentIds exist', async () => {
      const caller = chatRouter.createCaller(ctx);
      const documentIds = ['550e8400-e29b-41d4-a716-446655440000'];
      const result = await caller.addMessage({ ...mockInput, documentIds, knowledgeBaseIds: [] });

      // Embedding functions are NOT called in the route (they happen in worker)
      expect(embedContent).not.toHaveBeenCalled();
      expect(getEmbeddingsForDocuments).not.toHaveBeenCalled();

      // Async job should be queued with documentIds
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'chat-completion',
        expect.objectContaining({
          chatId: mockChatId,
          documentIds,
          knowledgeBaseIds: [],
        }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );

      expect(result.isAsyncChat).toBe(true);
      expect(result.asyncChatJobId).toBeDefined();
    });

    it('should queue async job even when there are no document ids or knowledge base ids', async () => {
      const caller = chatRouter.createCaller(ctx);

      const result = await caller.addMessage({ ...mockInput, documentIds: [], knowledgeBaseIds: [] });

      // All non-deep-research chats are now processed async via worker
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'chat-completion',
        expect.objectContaining({ chatId: mockChatId, documentIds: [], knowledgeBaseIds: [] }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
      expect(embedContent).not.toHaveBeenCalled();

      expect(result.isAsyncChat).toBe(true);
      expect(result.asyncChatJobId).toBeDefined();
    });

    it('should queue async job with multiple documentIds', async () => {
      const caller = chatRouter.createCaller(ctx);
      const documentIds = ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'];

      await caller.addMessage({ ...mockInput, documentIds, knowledgeBaseIds: [] });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'chat-completion',
        expect.objectContaining({
          documentIds,
        }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );

      // The user message is persisted with the documents attached to the turn
      expect(createMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: MessageRole.User,
              documentIds,
            }),
          ]),
        })
      );
    });
  });

  describe('useGraph flag behavior', () => {
    // Note: Graph context building now happens in the async worker, not the route.
    // These tests verify that useGraph is passed correctly to the async job.
    const documentIds = ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'];

    describe('useGraph: true with documents', () => {
      beforeEach(() => {
        // Simulate that the selected documents are graphed
        (db.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(1) }]);
      });

      it('should pass useGraph=true to async job when useGraph is true and user has access', async () => {
        const caller = chatRouter.createCaller(ctx);
        const result = await caller.addMessage({
          ...mockInput,
          documentIds,
          useGraph: true,
          knowledgeBaseIds: [],
        });

        // Graph context building does NOT happen in route (happens in worker)
        expect(buildGraphContext).not.toHaveBeenCalled();
        expect(addContextToMessage).not.toHaveBeenCalled();

        // Async job should be queued with useGraph=true
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'chat-completion',
          expect.objectContaining({
            documentIds,
            useGraph: true,
          }),
          expect.objectContaining({ jobId: expect.any(String) }),
        );

        expect(result.isAsyncChat).toBe(true);
      });

      it('should pass useGraph=true to async job even when getUserGraphDatabaseAccess returns false (server no longer overrides client value)', async () => {
        (getUserGraphDatabaseAccess as jest.Mock).mockResolvedValue(false);

        const caller = chatRouter.createCaller(ctx);
        await caller.addMessage({
          ...mockInput,
          documentIds,
          useGraph: true,
          knowledgeBaseIds: [],
        });

        // useGraph passes through from the client unchanged — server no longer derives effectiveUseGraph
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'chat-completion',
          expect.objectContaining({
            documentIds,
            useGraph: true,
          }),
          expect.objectContaining({ jobId: expect.any(String) }),
        );
      });
    });

    describe('useGraph: false with documents', () => {
      it('should pass useGraph=false to async job when useGraph is false', async () => {
        const caller = chatRouter.createCaller(ctx);
        await caller.addMessage({
          ...mockInput,
          documentIds,
          useGraph: false,
          knowledgeBaseIds: [],
        });

        // buildGraphContext should NOT be called in route
        expect(buildGraphContext).not.toHaveBeenCalled();

        // Async job should be queued with useGraph=false
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'chat-completion',
          expect.objectContaining({
            documentIds,
            useGraph: false,
          }),
          expect.objectContaining({ jobId: expect.any(String) }),
        );
      });
    });

    describe('useGraph: true without documents', () => {
      it('should queue async job with useGraph=true when no documents selected (client value passes through)', async () => {
        const caller = chatRouter.createCaller(ctx);
        await caller.addMessage({
          ...mockInput,
          documentIds: [],
          useGraph: true,
          knowledgeBaseIds: [],
        });

        // Graph context is not built in the route
        expect(buildGraphContext).not.toHaveBeenCalled();

        // useGraph passes through from the client unchanged
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'chat-completion',
          expect.objectContaining({
            documentIds: [],
            useGraph: true,
          }),
          expect.objectContaining({ jobId: expect.any(String) }),
        );
      });

      it('should work with knowledge bases only and useGraph true', async () => {
        const caller = chatRouter.createCaller(ctx);
        await caller.addMessage({
          ...mockInput,
          documentIds: [],
          useGraph: true,
          knowledgeBaseIds: mockKnowledgeBaseIds,
        });

        // Should still call KB functions
        expect(getContentFromKbs).toHaveBeenCalled();
        // Should not call graph context (no documents)
        expect(buildGraphContext).not.toHaveBeenCalled();

        // useGraph passes through from the client unchanged
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'chat-completion',
          expect.objectContaining({
            documentIds: [],
            knowledgeBaseIds: mockKnowledgeBaseIds,
            useGraph: true,
          }),
          expect.objectContaining({ jobId: expect.any(String) }),
        );
      });
    });

    describe('Mixed documents and knowledge bases with graph', () => {
      beforeEach(() => {
        (db.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(1) }]);
      });

      it('should queue async job with both KB and document IDs when both are provided', async () => {
        const caller = chatRouter.createCaller(ctx);
        await caller.addMessage({
          ...mockInput,
          documentIds,
          useGraph: true,
          knowledgeBaseIds: mockKnowledgeBaseIds,
        });

        // Should call KB functions
        expect(getContentFromKbs).toHaveBeenCalled();

        // Async job should be queued with both
        expect(mockQueueAdd).toHaveBeenCalledWith(
          'chat-completion',
          expect.objectContaining({
            documentIds,
            knowledgeBaseIds: mockKnowledgeBaseIds,
            useGraph: true,
          }),
          expect.objectContaining({ jobId: expect.any(String) }),
        );
      });
    });
  });

  describe('agent provider chat', () => {
    const mockAgentProviderId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const mockSessionId = 'test-session-id-abc123';
    const mockAgentProvider = {
      id: mockAgentProviderId,
      name: 'Test Agent',
      endpoint: 'https://agent.example.com',
      apiKey: 'test-api-key',
      deletedAt: null,
    };

    beforeEach(() => {
      (getChat as jest.Mock).mockResolvedValue({
        ...mockGetChatResolvedValue,
        modelId: null,
        agentProviderId: mockAgentProviderId,
        externalSessionId: null,
      });
      mockAgentProviderFindFirst.mockResolvedValue(mockAgentProvider);
      (ensureAgentSession as jest.Mock).mockResolvedValue(mockSessionId);
      (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);
    });

    it('routes to agent queue when chat has agentProviderId', async () => {
      const caller = chatRouter.createCaller(ctx);
      await caller.addMessage({ ...mockInput, knowledgeBaseIds: [], documentIds: [] });

      expect(mockAgentProviderFindFirst).toHaveBeenCalledWith({
        where: { id: mockAgentProviderId, deletedAt: null },
      });
      expect(ensureAgentSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockChatId }),
        mockMessage,
        mockAgentProvider.endpoint,
        mockAgentProvider.apiKey,
      );
      expect(mockAgentQueueAdd).toHaveBeenCalledWith(
        'agent-chat-completion',
        expect.objectContaining({
          chatId: mockChatId,
          agentProviderId: mockAgentProviderId,
          sessionId: mockSessionId,
          userMessage: mockMessage,
        }),
        expect.any(Object),
      );
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('does not throw when modelId is null and agentProviderId is set', async () => {
      const caller = chatRouter.createCaller(ctx);
      await expect(
        caller.addMessage({ ...mockInput, knowledgeBaseIds: [], documentIds: [] })
      ).resolves.not.toThrow();
    });
  });
});
