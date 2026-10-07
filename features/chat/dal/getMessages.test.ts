import db from '@/server/db';
import logger from '@/server/logger';
import getMessages from './getMessages';
import { MessageRole } from '@/features/chat/types/message';

jest.mock('@/server/db', () => ({
  chatMessage: {
    findMany: jest.fn(),
  },
}));

describe('getMessages', () => {
  const mockChatId = '79e3cf0e-af60-41c4-9728-c83510c8ddda';
  const mockMessages = [
    {
      id: '3a2c991e-99dd-47c1-a1f2-ca0f8386a7e9',
      chatId: mockChatId,
      role: MessageRole.User,
      content: 'Hello, world!',
      createdAt: new Date(),
      documentIds: ['1f9f6a34-3f0a-4e2c-8b1d-2a3c4d5e6f70'],
      deepResearch: false,
      chatMessageCitations: [],
      chatArtifacts: [],
      chatMessageFollowUp: [],
      chatMessageUserChoices: [],
      graphSearchResult: null,
    },
    {
      id: '492668b6-274d-40eb-be5b-5c255147e888',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'Hi there!',
      createdAt: new Date(),
      documentIds: [],
      deepResearch: true,
      chatMessageCitations: [
        {
          knowledgeBaseId: '2e2dbcb4-c222-42ea-9642-77c1c1d5bb12',
          documentId: null,
          knowledgeBase: { label: 'Knowledge Base 1' },
          document: null,
          citation: 'Document A',
        },
      ],
      chatArtifacts: [
        {
          id: 'artifact-123',
          fileExtension: '.txt',
          label: 'Sample Artifact',
          content: 'Artifact content',
          chatMessageId: '492668b6-274d-40eb-be5b-5c255147e888',
          githubPagesUrl: null,
          createdAt: new Date(),
        },
      ],
      chatMessageFollowUp: [],
      chatMessageUserChoices: [],
      graphSearchResult: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches messages successfully with artifacts', async () => {
    (db.chatMessage.findMany as jest.Mock).mockResolvedValue(mockMessages);

    const result = await getMessages(mockChatId);

    expect(db.chatMessage.findMany).toHaveBeenCalledWith({
      where: { chatId: mockChatId },
      orderBy: { createdAt: 'asc' },
      include: {
        chatMessageCitations: {
          include: {
            knowledgeBase: true,
            document: true,
            embedding: {
              select: {
                startPosition: true,
                endPosition: true,
                sectionPath: true,
                pageStart: true,
                pageEnd: true,
              },
            },
            graphEntity: true,
            graphConcept: true,
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
        chatMessageUserChoices: true,
        graphSearchResult: true,
        graphSnapshot: true,
        assistantChatMessageFeedback: true,
      },
    });

    expect(result).toEqual([
      {
        id: mockMessages[0].id,
        chatId: mockChatId,
        role: mockMessages[0].role,
        content: mockMessages[0].content,
        createdAt: expect.any(Date),
        documentIds: mockMessages[0].documentIds,
        deepResearch: false,
        deepResearchJobId: undefined,
        deepResearchStatus: undefined,
        asyncChatJobId: undefined,
        asyncChatStatus: undefined,
        citations: [],
        artifacts: [],
        followUps: [],
        userChoices: [],
        graphSearchResult: null,
        graphSnapshot: null,
        feedback: null,
      },
      {
        id: mockMessages[1].id,
        chatId: mockChatId,
        role: mockMessages[1].role,
        content: mockMessages[1].content,
        createdAt: expect.any(Date),
        documentIds: mockMessages[1].documentIds,
        deepResearch: true,
        deepResearchJobId: undefined,
        deepResearchStatus: undefined,
        asyncChatJobId: undefined,
        asyncChatStatus: undefined,
        citations: [
          {
            citation: 'Document A',
            contextType: 'KNOWLEDGE_BASE',
            knowledgeBaseId: '2e2dbcb4-c222-42ea-9642-77c1c1d5bb12',
            sourceLabel: 'Knowledge Base 1',
          },
        ],
        artifacts: [
          {
            id: mockMessages[1].chatArtifacts[0].id,
            fileExtension: mockMessages[1].chatArtifacts[0].fileExtension,
            label: mockMessages[1].chatArtifacts[0].label,
            content: mockMessages[1].chatArtifacts[0].content,
            chatMessageId: mockMessages[1].chatArtifacts[0].chatMessageId,
            githubPagesUrl: null,
            githubUrl: null,
            createdAt: expect.any(Date),
          },
        ],
        followUps: [],
        userChoices: [],
        graphSearchResult: null,
        graphSnapshot: null,
        feedback: null,
      },
    ]);
  });

  it('logs an error and throws an exception if a database error occurs', async () => {
    const mockError = new Error('Database error');
    (db.chatMessage.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getMessages(mockChatId)).rejects.toThrow('Error fetching messages');

    expect(logger.error).toHaveBeenCalledWith(`Error fetching messages from the database. ChatId: ${mockChatId}`, mockError);
  });

  it('fetches messages with document library citations including embedding data', async () => {
    const mockMessagesWithDocCitations = [
      {
        id: 'msg-user',
        chatId: mockChatId,
        role: MessageRole.User,
        content: 'User question',
        createdAt: new Date(),
        deepResearch: false,
        chatMessageCitations: [],
        chatArtifacts: [],
        chatMessageFollowUp: [],
        chatMessageUserChoices: [],
        graphSearchResult: null,
      },
      {
        id: 'msg-assistant',
        chatId: mockChatId,
        role: MessageRole.Assistant,
        content: 'Assistant response',
        createdAt: new Date(),
        deepResearch: false,
        chatMessageCitations: [
          {
            knowledgeBaseId: null,
            documentId: 'doc-123',
            embeddingId: 'emb-456',
            knowledgeBase: null,
            document: { filename: 'research.pdf' },
            embedding: {
              startPosition: 25,
              endPosition: 125,
              sectionPath: ['Overview', 'Findings'],
              pageStart: 3,
              pageEnd: 5,
            },
            citation: 'Relevant text from research paper',
          },
        ],
        chatArtifacts: [],
        chatMessageFollowUp: [],
        chatMessageUserChoices: [],
        graphSearchResult: null,
      },
    ];

    (db.chatMessage.findMany as jest.Mock).mockResolvedValue(mockMessagesWithDocCitations);

    const result = await getMessages(mockChatId);

    expect(result[1].citations).toEqual([
      {
        contextType: 'DOCUMENT_LIBRARY',
        documentId: 'doc-123',
        embeddingId: 'emb-456',
        sourceLabel: 'research.pdf',
        citation: 'Relevant text from research paper',
        startPosition: 25,
        endPosition: 125,
        sectionPath: ['Overview', 'Findings'],
        pageStart: 3,
        pageEnd: 5,
      },
    ]);
  });
});

describe('getMessages prior-conversation citations', () => {
  it('maps a cited message with its source chat metadata', async () => {
    const messageCreatedAt = new Date('2026-08-10T12:00:00.000Z');
    const artifactCreatedAt = new Date('2026-08-09T12:00:00.000Z');
    (db.chatMessage.findMany as jest.Mock).mockResolvedValue([{
      id: 'message-1',
      chatId: 'chat-1',
      role: MessageRole.Assistant,
      content: 'Answer',
      createdAt: new Date(),
      documentIds: [],
      deepResearch: false,
      chatMessageCitations: [{
        citedMessageId: 'cited-message-1',
        citedMessage: {
          id: 'cited-message-1',
          chatId: 'source-chat-1',
          role: MessageRole.User,
          createdAt: messageCreatedAt,
          chat: { summary: 'Planning chat' },
          chatArtifacts: [{
            id: 'artifact-1',
            label: 'Plan',
            fileExtension: '.md',
            createdAt: artifactCreatedAt,
          }],
        },
        citation: 'The original plan.',
      }],
      chatArtifacts: [],
      chatMessageFollowUp: [],
      chatMessageUserChoices: [],
      graphSearchResult: null,
      graphSnapshot: null,
    }]);

    const [result] = await getMessages('chat-1');

    expect(result.citations).toEqual([{
      contextType: 'PRIOR_CONVERSATION',
      citedMessageId: 'cited-message-1',
      chatId: 'source-chat-1',
      role: MessageRole.User,
      messageCreatedAt,
      artifacts: [{
        id: 'artifact-1',
        label: 'Plan',
        fileExtension: '.md',
        createdAt: artifactCreatedAt,
      }],
      sourceLabel: 'Planning chat',
      citation: 'The original plan.',
    }]);
  });
});

describe('getMessages graphSearchResult normalization', () => {
  const mockChatId = '79e3cf0e-af60-41c4-9728-c83510c8ddda';
  const sampleData = { rows: [{ name: 'A' }], nodeMapping: [], query: 'q', rowCount: 1, generatedCypher: 'MATCH ...' };
  const baseRow = {
    id: 'm1',
    chatId: mockChatId,
    role: MessageRole.Assistant,
    content: 'hi',
    createdAt: new Date(),
    deepResearch: false,
    chatMessageCitations: [],
    chatArtifacts: [],
    chatMessageFollowUp: [],
    chatMessageUserChoices: [],
    graphSearchResult: null,
    graphSnapshot: null,
  };

  beforeEach(() => jest.clearAllMocks());

  it('wraps a legacy single-object data blob into a one-element array', async () => {
    (db.chatMessage.findMany as jest.Mock).mockResolvedValue([{ ...baseRow, graphSearchResult: { data: sampleData } }]);
    const [msg] = await getMessages(mockChatId);
    expect(Array.isArray(msg.graphSearchResult)).toBe(true);
    expect(msg.graphSearchResult).toEqual([sampleData]);
  });

  it('passes through an array data blob unchanged (multi-tab agentic turn)', async () => {
    const arrayData = [sampleData, { ...sampleData, query: 'q2' }];
    (db.chatMessage.findMany as jest.Mock).mockResolvedValue([{ ...baseRow, graphSearchResult: { data: arrayData } }]);
    const [msg] = await getMessages(mockChatId);
    expect(msg.graphSearchResult).toEqual(arrayData);
  });

  it('returns null when the message has no graph search result', async () => {
    (db.chatMessage.findMany as jest.Mock).mockResolvedValue([{ ...baseRow, graphSearchResult: null }]);
    const [msg] = await getMessages(mockChatId);
    expect(msg.graphSearchResult).toBeNull();
  });
});
