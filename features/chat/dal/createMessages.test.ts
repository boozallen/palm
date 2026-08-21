import db from '@/server/db';
import logger from '@/server/logger';
import createMessages, { CreateMessagesInput } from './createMessages';
import { ContextType, MessageRole, Citation } from '@/features/chat/types/message';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
  chatMessage: {
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  chatMessageCitation: {
    createMany: jest.fn(),
  },
  chatArtifact: {
    createMany: jest.fn(),
  },
  chatMessageFollowUp: {
    createMany: jest.fn(),
  },
}));

describe('createMessages', () => {
  const mockChatId = '0529b3a4-df90-4b1e-8195-4a4cb563078e';
  const mockAssistantChatMessageId = '912b8275-efe8-452f-a517-da6b50708d5c';

  const mockCitations: Citation[] = [
    {
      citation: 'Document A',
      sourceLabel: 'Knowledge Base 1',
      contextType: ContextType.KNOWLEDGE_BASE,
      knowledgeBaseId: '6534284c-7ea3-4b38-96a9-4417e4f5212b',
    },
  ];

  const mockMessages = [
    {
      id: '788ee003-8950-4f77-becc-5066ea9b4a9d',
      role: MessageRole.User,
      content: 'Hello, world!',
      createdAt: new Date(),
      citations: [],
      artifacts: [],
      followUpQuestions: [],
      deepResearch: false,
    },
    {
      id: mockAssistantChatMessageId,
      role: MessageRole.Assistant,
      content: 'Hi there!',
      createdAt: new Date(),
      citations: mockCitations,
      artifacts: [
        {
          id: 'artifact-1',
          chatMessageId: mockAssistantChatMessageId,
          fileExtension: '.txt',
          label: 'Artifact 1',
          content: 'Artifact content',
          githubPagesUrl: null,
          createdAt: new Date(),
        },
      ],
      followUpQuestions: ['This is a test follow up question'],
      deepResearch: false,
    },
  ];

  const input: CreateMessagesInput = {
    chatId: mockChatId,
    messages: mockMessages,
  };

  const mockNewMessages = [
    {
      id: mockMessages[0].id,
      chatId: mockChatId,
      role: mockMessages[0].role,
      content: mockMessages[0].content,
      createdAt: new Date(),
      documentIds: [],
      deepResearch: false,
      chatMessageCitations: [],
      chatArtifacts: [],
      chatMessageFollowUp: [],
    },
    {
      id: mockMessages[1].id,
      chatId: mockChatId,
      role: mockMessages[1].role,
      content: mockMessages[1].content,
      createdAt: new Date(),
      documentIds: [],
      deepResearch: false,
      chatMessageCitations: [
        {
          citation: 'Document A',
          knowledgeBase: { label: 'Knowledge Base 1' },
          contextType: ContextType.KNOWLEDGE_BASE,
          knowledgeBaseId: '6534284c-7ea3-4b38-96a9-4417e4f5212b',
        },
      ],
      chatArtifacts: [
        {
          id: 'artifact-1',
          fileExtension: '.txt',
          label: 'Artifact 1',
          content: 'Artifact content',
          chatMessageId: mockMessages[1].id,
          githubPagesUrl: null,
          githubUrl: null,
          createdAt: new Date(),
        },
      ],
      chatMessageFollowUp: [{
        id: 'follow-up-1',
        content: 'This is a test follow up question',
        chatMessageId: mockMessages[1].id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates messages, citations, artifacts, and follow-ups successfully', async () => {
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      await callback({
        chatMessage: db.chatMessage,
        chatMessageCitation: db.chatMessageCitation,
        chatArtifact: db.chatArtifact,
        chatMessageFollowUp: db.chatMessageFollowUp,
      });
    });

    (db.chatMessage.findMany as jest.Mock).mockResolvedValue(mockNewMessages);

    const result = await createMessages(input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.chatMessage.createMany).toHaveBeenCalledWith({
      data: input.messages.map((message) => ({
        id: message.id,
        chatId: input.chatId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        documentIds: message.documentIds ?? [],
        deepResearch: message.deepResearch,
      })),
    });

    expect(db.chatMessageCitation.createMany).toHaveBeenCalledWith({
      data: input.messages[1].citations.map((citation) => ({
        chatMessageId: input.messages[1].id,
        knowledgeBaseId: mockCitations[0].contextType === ContextType.KNOWLEDGE_BASE ? mockCitations[0].knowledgeBaseId : null,
        citation: citation.citation,
      })),
    });

    expect(db.chatArtifact.createMany).toHaveBeenCalledWith({
      data: input.messages[1].artifacts.map((artifact) => ({
        id: artifact.id,
        fileExtension: artifact.fileExtension,
        label: artifact.label,
        content: artifact.content,
        chatMessageId: artifact.chatMessageId,
        createdAt: artifact.createdAt,
      })),
    });

    expect(db.chatMessageFollowUp.createMany).toHaveBeenCalledWith({
      data: input.messages[1].followUpQuestions.map((question) => ({
        content: question,
        chatMessageId: input.messages[1].id,
      })),
    });

    expect(db.chatMessage.findMany).toHaveBeenCalledWith({
      where: {
        chatId: input.chatId,
        id: { in: input.messages.map(message => message.id) },
      },
      include: {
        chatMessageCitations: {
          include: {
            knowledgeBase: true,
            document: true,
            embedding: true,
            graphEntity: true,
            graphConcept: true,
          },
        },
        chatArtifacts: true,
        chatMessageFollowUp: true,
      },
    });

    expect(result).toEqual([
      {
        id: mockNewMessages[0].id,
        chatId: mockChatId,
        role: mockNewMessages[0].role,
        content: mockNewMessages[0].content,
        createdAt: expect.any(Date),
        documentIds: [],
        deepResearch: false,
        deepResearchJobId: undefined,
        deepResearchStatus: undefined,
        asyncChatJobId: undefined,
        asyncChatStatus: undefined,
        citations: [],
        artifacts: [],
        followUps: [],
        userChoices: [],
      },
      {
        id: mockNewMessages[1].id,
        chatId: mockChatId,
        role: mockNewMessages[1].role,
        content: mockNewMessages[1].content,
        createdAt: expect.any(Date),
        documentIds: [],
        deepResearch: false,
        deepResearchJobId: undefined,
        deepResearchStatus: undefined,
        asyncChatJobId: undefined,
        asyncChatStatus: undefined,
        citations: mockCitations,
        artifacts: [
          {
            id: mockNewMessages[1].chatArtifacts[0].id,
            fileExtension: mockNewMessages[1].chatArtifacts[0].fileExtension,
            label: mockNewMessages[1].chatArtifacts[0].label,
            content: mockNewMessages[1].chatArtifacts[0].content,
            chatMessageId: mockNewMessages[1].chatArtifacts[0].chatMessageId,
            githubPagesUrl: null,
            githubUrl: null,
            createdAt: expect.any(Date),
          },
        ],
        followUps: [{
          id: mockNewMessages[1].chatMessageFollowUp[0].id,
          content: mockNewMessages[1].chatMessageFollowUp[0].content,
          chatMessageId: mockNewMessages[1].chatMessageFollowUp[0].chatMessageId,
          createdAt: mockNewMessages[1].chatMessageFollowUp[0].createdAt,
          updatedAt: mockNewMessages[1].chatMessageFollowUp[0].updatedAt,
        }],
        userChoices: [],
      },
    ]);
  });

  it('logs an error and throws an exception if an error occurs', async () => {
    const mockError = new Error('Database error');
    (db.$transaction as jest.Mock).mockRejectedValue(mockError);

    await expect(createMessages(input)).rejects.toThrow('Error creating messages');

    expect(logger.error).toHaveBeenCalledWith(`Error creating messages: ChatId: ${input.chatId}`, mockError);
  });

  it('creates messages with document library citations including embedding data', async () => {
    const mockDocumentCitations: Citation[] = [
      {
        citation: 'Document content from library',
        sourceLabel: 'test-doc.pdf',
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-123',
        embeddingId: 'emb-456',
        startPosition: 100,
        endPosition: 200,
      },
    ];

    const messagesWithDocCitations = [
      {
        id: 'msg-user-1',
        role: MessageRole.User,
        content: 'Query about document',
        createdAt: new Date(),
        citations: [],
        artifacts: [],
        followUpQuestions: [],
        deepResearch: false,
      },
      {
        id: 'msg-assistant-1',
        role: MessageRole.Assistant,
        content: 'Response with document citation',
        createdAt: new Date(),
        citations: mockDocumentCitations,
        artifacts: [],
        followUpQuestions: [],
        deepResearch: false,
      },
    ];

    const inputWithDocCitations: CreateMessagesInput = {
      chatId: mockChatId,
      messages: messagesWithDocCitations,
    };

    const mockNewMessagesWithDocCitations = [
      {
        id: messagesWithDocCitations[0].id,
        chatId: mockChatId,
        role: messagesWithDocCitations[0].role,
        content: messagesWithDocCitations[0].content,
        createdAt: new Date(),
        deepResearch: false,
        chatMessageCitations: [],
        chatArtifacts: [],
        chatMessageFollowUp: [],
      },
      {
        id: messagesWithDocCitations[1].id,
        chatId: mockChatId,
        role: messagesWithDocCitations[1].role,
        content: messagesWithDocCitations[1].content,
        createdAt: new Date(),
        deepResearch: false,
        chatMessageCitations: [
          {
            citation: 'Document content from library',
            documentId: 'doc-123',
            embeddingId: 'emb-456',
            knowledgeBase: null,
            knowledgeBaseId: null,
            document: { filename: 'test-doc.pdf' },
            embedding: {
              startPosition: 100,
              endPosition: 200,
            },
          },
        ],
        chatArtifacts: [],
        chatMessageFollowUp: [],
      },
    ];

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      await callback({
        chatMessage: db.chatMessage,
        chatMessageCitation: db.chatMessageCitation,
        chatArtifact: db.chatArtifact,
        chatMessageFollowUp: db.chatMessageFollowUp,
      });
    });

    (db.chatMessage.findMany as jest.Mock).mockResolvedValue(mockNewMessagesWithDocCitations);

    const result = await createMessages(inputWithDocCitations);

    expect(db.chatMessageCitation.createMany).toHaveBeenCalledWith({
      data: [
        {
          chatMessageId: messagesWithDocCitations[1].id,
          documentId: 'doc-123',
          embeddingId: 'emb-456',
          citation: 'Document content from library',
        },
      ],
    });

    expect(result[1].citations).toEqual([
      {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-123',
        embeddingId: 'emb-456',
        sourceLabel: 'test-doc.pdf',
        citation: 'Document content from library',
        startPosition: 100,
        endPosition: 200,
      },
    ]);
  });
});
