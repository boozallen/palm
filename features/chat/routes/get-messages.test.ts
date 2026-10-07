jest.mock('@/features/graph-database/sources/neo4j', () => {
  return {
    Neo4jSource: jest.fn().mockImplementation(() => ({
      __mocked: true,
    })),
  };
});

import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';

jest.mock('@/features/chat/dal/getMessages');
jest.mock('@/features/chat/dal/getChat');

const mockUserId = '570e3594-0ff3-475d-9ee0-4be261e6b8db';
const mockChatId = 'fcc14cff-37ba-42bb-8d83-c5618d25acd3';

const mockGetChatResolvedValue = {
  id: mockChatId,
  userId: mockUserId,
  modelId: '552079c8-53aa-4614-92fb-8eb5780eea4e',
  promptId: null,
  summary: 'Chat summary',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGetMessagesResolvedValue = [
  {
    id: 'b96e13a2-08fb-4d9f-bdf7-4419ca5d42b5',
    chatId: mockChatId,
    role: 'User',
    content: 'What is the best color?',
    createdAt: new Date(),
    documentIds: ['c3f8b1e2-9a4d-4c6b-8f1a-2b3c4d5e6f70'],
    deepResearch: false,
    citations: [],
    artifacts: [],
    followUps: [],
    userChoices: [],
  },
  {
    id: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
    chatId: mockChatId,
    role: 'Assistant',
    content: 'This is the AI response',
    createdAt: new Date(),
    documentIds: [],
    deepResearch: true,
    citations: [],
    artifacts: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fileExtension: 'txt',
        label: 'Sample Artifact',
        content: 'Artifact content here',
        chatMessageId: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
        githubPagesUrl: null,
        createdAt: new Date(),
      },
    ],
    followUps: [{
      id: '01a542ef-393d-42be-a4f7-b0cf07229a86',
      chatMessageId: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
      content: 'This is a test',
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
    userChoices: [],
    graphSearchResult: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      label: 'Graph Results (3 rows)',
      data: {
        rows: [{ Name: 'Entity A' }],
        nodeMapping: [{ rowIndex: 0, entityIds: ['entity-1'] }],
        query: 'list all entities',
        rowCount: 1,
        generatedCypher: 'MATCH (n) RETURN n',
      },
      chatMessageId: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
      createdAt: new Date(),
    },
  },
];

describe('getMessages procedure', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getChat as jest.Mock).mockResolvedValue(mockGetChatResolvedValue);
    (getMessages as jest.Mock).mockResolvedValue(mockGetMessagesResolvedValue);

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      logger: logger,
    } as unknown as ContextType;
  });

  it('returns the chat messages successfully with artifacts adn followup', async () => {
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getMessages(input);

    expect(result).toEqual({
      chatId: mockChatId,
      messages: mockGetMessagesResolvedValue.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messagedAt: msg.createdAt,
        documentIds: msg.documentIds,
        deepResearch: msg.deepResearch,
        citations: msg.citations,
        artifacts: msg.artifacts,
        followUps: msg.followUps,
        userChoices: msg.userChoices,
        graphSearchResult: msg.graphSearchResult,
      })),
    });
  });

  it('throws error if user does not own chat and is not an admin', async () => {
    ctx.userId = 'some-other-user-id';
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getMessages(input)).rejects.toThrow('You do not have permission to view messages from this chat');

    expect(logger.error).toHaveBeenCalledWith(
      `You do not have permission to view messages from this chat: userId: ${ctx.userId}, chatId: ${mockChatId}`
    );
  });

  it('returns messages if user is an admin', async () => {
    ctx.userRole = UserRole.Admin;
    ctx.userId = 'some-other-user-id';
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getMessages(input);

    expect(result).toEqual({
      chatId: mockChatId,
      messages: mockGetMessagesResolvedValue.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messagedAt: msg.createdAt,
        documentIds: msg.documentIds,
        deepResearch: msg.deepResearch,
        citations: msg.citations,
        artifacts: msg.artifacts,
        followUps: msg.followUps,
        userChoices: msg.userChoices,
        graphSearchResult: msg.graphSearchResult,
      })),
    });
  });

  it('throws error if messages retrieval fails', async () => {
    (getMessages as jest.Mock).mockRejectedValue(new Error('Database error'));
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getMessages(input)).rejects.toThrow('Database error');
  });

  it('returns messages with document library citations including embedding data', async () => {
    const mockMessagesWithCitations = [
      {
        id: 'b96e13a2-08fb-4d9f-bdf7-4419ca5d42b5',
        chatId: mockChatId,
        role: 'User',
        content: 'What is in the document?',
        createdAt: new Date(),
        documentIds: ['550e8400-e29b-41d4-a716-446655440000'],
        deepResearch: false,
        citations: [],
        artifacts: [],
        followUps: [],
        userChoices: [],
        graphSearchResult: null,
      },
      {
        id: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
        chatId: mockChatId,
        role: 'Assistant',
        content: 'Here is what the document says',
        createdAt: new Date(),
        documentIds: [],
        deepResearch: false,
        citations: [
          {
            contextType: 'DOCUMENT_LIBRARY' as const,
            documentId: '550e8400-e29b-41d4-a716-446655440000',
            embeddingId: '550e8400-e29b-41d4-a716-446655440001',
            sourceLabel: 'test-doc.pdf',
            citation: 'Document content from library',
            startPosition: 100,
            endPosition: 200,
          },
        ],
        artifacts: [],
        followUps: [],
        userChoices: [],
        graphSearchResult: null,
      },
    ];

    (getMessages as jest.Mock).mockResolvedValue(mockMessagesWithCitations);

    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getMessages(input);

    expect(result).toEqual({
      chatId: mockChatId,
      messages: mockMessagesWithCitations.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messagedAt: msg.createdAt,
        documentIds: msg.documentIds,
        deepResearch: msg.deepResearch,
        citations: msg.citations,
        artifacts: msg.artifacts,
        followUps: msg.followUps,
        userChoices: msg.userChoices,
        graphSearchResult: msg.graphSearchResult,
      })),
    });

    expect(result.messages[1].citations[0]).toEqual({
      contextType: 'DOCUMENT_LIBRARY',
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      embeddingId: '550e8400-e29b-41d4-a716-446655440001',
      sourceLabel: 'test-doc.pdf',
      citation: 'Document content from library',
      startPosition: 100,
      endPosition: 200,
    });
  });

  it('accepts prior-conversation citations in the output schema', async () => {
    const artifactCreatedAt = new Date('2026-08-09T12:00:00.000Z');
    const priorCitation = {
      contextType: 'PRIOR_CONVERSATION' as const,
      citedMessageId: 'cited-message-1',
      chatId: 'source-chat-1',
      role: 'assistant',
      messageCreatedAt: new Date('2026-08-10T12:00:00.000Z'),
      artifacts: [{
        id: 'artifact-1',
        label: 'Decision log',
        fileExtension: '.docx',
        createdAt: artifactCreatedAt,
      }],
      sourceLabel: 'Architecture decisions',
      citation: 'We chose pgvector.',
    };
    (getMessages as jest.Mock).mockResolvedValue([
      { ...mockGetMessagesResolvedValue[1], citations: [priorCitation] },
    ]);

    const result = await chatRouter.createCaller(ctx).getMessages({ chatId: mockChatId });

    expect(result.messages[0].citations).toEqual([priorCitation]);
  });

  it('returns messages with graphSearchResult when present', async () => {
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getMessages(input);

    // First message (user) should have no graphSearchResult
    expect(result.messages[0].graphSearchResult).toBeUndefined();

    // Second message (assistant) should have graphSearchResult
    expect(result.messages[1].graphSearchResult).toBeDefined();
    expect(result.messages[1].graphSearchResult).toEqual(
      mockGetMessagesResolvedValue[1].graphSearchResult
    );
  });
});
