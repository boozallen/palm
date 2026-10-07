import db from '@/server/db';
import logger from '@/server/logger';
import getMessage from './getMessage';
import { MessageRole } from '@/features/chat/types/message';

jest.mock('@/server/db', () => ({
  chatMessage: {
    findUnique: jest.fn(),
  },
}));

describe('getMessage', () => {
  const mockMessageId = 'cc982788-2d80-49c6-add2-814e3adfc5d8';
  const mockMessage = {
    id: mockMessageId,
    chatId: 'ee32c554-82b0-48f9-9097-6188e05db1bc',
    role: MessageRole.Assistant,
    content: 'How can I help you?',
    createdAt: new Date(),
    documentIds: ['0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d'],
    deepResearch: false,
    chatMessageCitations: [
      {
        knowledgeBaseId: '5cf4c35a-4111-4e2c-b07d-c01bc6160778',
        documentId: undefined,
        knowledgeBase: { label: 'Knowledge Base 1' },
        document: null,
        citation: 'Document B',
      },
    ],
    chatArtifacts: [
      {
        id: 'artifact-id',
        fileExtension: '.pdf',
        label: 'Artifact Label',
        content: 'Artifact Content',
        chatMessageId: mockMessageId,
        githubPagesUrl: null,
        createdAt: new Date(),
      },
    ],
    chatMessageFollowUp: [
      {
        id: 'follow-up-id',
        content: 'This is a question?',
        chatMessageId: mockMessageId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches a message with artifacts successfully', async () => {
    (db.chatMessage.findUnique as jest.Mock).mockResolvedValue(mockMessage);

    const result = await getMessage(mockMessageId);

    expect(db.chatMessage.findUnique).toHaveBeenCalledWith({
      where: { id: mockMessageId },
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
      },
    });

    expect(result).toEqual({
      id: mockMessage.id,
      chatId: mockMessage.chatId,
      role: mockMessage.role,
      content: mockMessage.content,
      createdAt: mockMessage.createdAt,
      documentIds: mockMessage.documentIds,
      deepResearch: false,
      citations: [
        {
          contextType: 'KNOWLEDGE_BASE',
          knowledgeBaseId: mockMessage.chatMessageCitations[0].knowledgeBaseId,
          sourceLabel: mockMessage.chatMessageCitations[0].knowledgeBase.label,
          citation: mockMessage.chatMessageCitations[0].citation,
        },
      ],
      artifacts: [
        {
          id: mockMessage.chatArtifacts[0].id,
          fileExtension: mockMessage.chatArtifacts[0].fileExtension,
          label: mockMessage.chatArtifacts[0].label,
          content: mockMessage.chatArtifacts[0].content,
          chatMessageId: mockMessage.chatArtifacts[0].chatMessageId,
          githubPagesUrl: null,
          githubUrl: null,
          createdAt: mockMessage.chatArtifacts[0].createdAt,
        },
      ],
      followUps: [
        {
          id: mockMessage.chatMessageFollowUp[0].id,
          content: mockMessage.chatMessageFollowUp[0].content,
          createdAt: mockMessage.chatMessageFollowUp[0].createdAt,
          updatedAt: mockMessage.chatMessageFollowUp[0].updatedAt,
          chatMessageId: mockMessage.chatMessageFollowUp[0].chatMessageId,
        },
      ],
      userChoices: [],
    });
  });

  it('fetches a message without artifacts successfully', async () => {
    const mockMessageWithoutArtifacts = { ...mockMessage, chatArtifacts: [] };
    (db.chatMessage.findUnique as jest.Mock).mockResolvedValue(mockMessageWithoutArtifacts);

    const result = await getMessage(mockMessageId);

    expect(result).toEqual({
      id: mockMessageWithoutArtifacts.id,
      chatId: mockMessageWithoutArtifacts.chatId,
      role: mockMessageWithoutArtifacts.role,
      content: mockMessageWithoutArtifacts.content,
      createdAt: mockMessageWithoutArtifacts.createdAt,
      documentIds: mockMessageWithoutArtifacts.documentIds,
      deepResearch: false,
      citations: [
        {
          contextType: 'KNOWLEDGE_BASE',
          knowledgeBaseId: mockMessage.chatMessageCitations[0].knowledgeBaseId,
          sourceLabel: mockMessage.chatMessageCitations[0].knowledgeBase.label,
          citation: mockMessage.chatMessageCitations[0].citation,
        },
      ],
      artifacts: [],
      followUps: [
        {
          id: mockMessage.chatMessageFollowUp[0].id,
          content: mockMessage.chatMessageFollowUp[0].content,
          createdAt: mockMessage.chatMessageFollowUp[0].createdAt,
          updatedAt: mockMessage.chatMessageFollowUp[0].updatedAt,
          chatMessageId: mockMessage.chatMessageFollowUp[0].chatMessageId,
        },
      ],
      userChoices: [],
    });
  });

  it('fetches a message with no follow ups successfully', async () => {
    const mockMessageWithoutFollowUps = { ...mockMessage, chatMessageFollowUp: [] };
    (db.chatMessage.findUnique as jest.Mock).mockResolvedValue(mockMessageWithoutFollowUps);

    const result = await getMessage(mockMessageId);

    expect(result).toEqual({
      id: mockMessageWithoutFollowUps.id,
      chatId: mockMessageWithoutFollowUps.chatId,
      role: mockMessageWithoutFollowUps.role,
      content: mockMessageWithoutFollowUps.content,
      createdAt: mockMessageWithoutFollowUps.createdAt,
      documentIds: mockMessageWithoutFollowUps.documentIds,
      deepResearch: false,
      citations: [
        {
          contextType: 'KNOWLEDGE_BASE',
          knowledgeBaseId: mockMessage.chatMessageCitations[0].knowledgeBaseId,
          sourceLabel: mockMessage.chatMessageCitations[0].knowledgeBase.label,
          citation: mockMessage.chatMessageCitations[0].citation,
        },
      ],
      artifacts: [
        {
          id: mockMessage.chatArtifacts[0].id,
          fileExtension: mockMessage.chatArtifacts[0].fileExtension,
          label: mockMessage.chatArtifacts[0].label,
          content: mockMessage.chatArtifacts[0].content,
          chatMessageId: mockMessage.chatArtifacts[0].chatMessageId,
          githubPagesUrl: null,
          githubUrl: null,
          createdAt: mockMessage.chatArtifacts[0].createdAt,
        },
      ],
      followUps: [],
      userChoices: [],
    });
  });

  it('logs an error and throws an exception if the message is not found', async () => {
    (db.chatMessage.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getMessage(mockMessageId)).rejects.toThrow('Message not found');

    expect(logger.error).toHaveBeenCalledWith(
      `Message not found in database: MessageId: ${mockMessageId}`
    );
  });

  it('logs an error and throws an exception if a database error occurs', async () => {
    const mockError = new Error('Database error');
    (db.chatMessage.findUnique as jest.Mock).mockRejectedValue(mockError);

    await expect(getMessage(mockMessageId)).rejects.toThrow('Error fetching message');

    expect(logger.error).toHaveBeenCalledWith(
      `Error fetching message from the database: MessageId: ${mockMessageId}`, mockError
    );
  });

  it('fetches a message with document library citations including embedding data', async () => {
    const mockMessageWithDocCitation = {
      id: mockMessageId,
      chatId: 'ee32c554-82b0-48f9-9097-6188e05db1bc',
      role: MessageRole.Assistant,
      content: 'Response with document citation',
      createdAt: new Date(),
      deepResearch: false,
      chatMessageCitations: [
        {
          knowledgeBaseId: null,
          documentId: 'doc-456',
          embeddingId: 'emb-789',
          knowledgeBase: null,
          document: { filename: 'test-document.pdf' },
          embedding: {
            startPosition: 50,
            endPosition: 150,
            sectionPath: ['Introduction', 'Background'],
            pageStart: 1,
            pageEnd: 2,
          },
          citation: 'Citation text from document',
        },
      ],
      chatArtifacts: [],
      chatMessageFollowUp: [],
    };

    (db.chatMessage.findUnique as jest.Mock).mockResolvedValue(mockMessageWithDocCitation);

    const result = await getMessage(mockMessageId);

    expect(result.citations).toEqual([
      {
        contextType: 'DOCUMENT_LIBRARY',
        documentId: 'doc-456',
        embeddingId: 'emb-789',
        sourceLabel: 'test-document.pdf',
        citation: 'Citation text from document',
        startPosition: 50,
        endPosition: 150,
        sectionPath: ['Introduction', 'Background'],
        pageStart: 1,
        pageEnd: 2,
      },
    ]);
  });
});

describe('getMessage prior-conversation citations', () => {
  it('does not misclassify a cited message as a document citation', async () => {
    const messageCreatedAt = new Date('2026-08-10T12:00:00.000Z');
    (db.chatMessage.findUnique as jest.Mock).mockResolvedValue({
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
          chat: { summary: null },
          chatArtifacts: [],
        },
        citation: 'The original request.',
      }],
      chatArtifacts: [],
      chatMessageFollowUp: [],
    });

    const result = await getMessage('message-1');

    expect(result.citations).toEqual([{
      contextType: 'PRIOR_CONVERSATION',
      citedMessageId: 'cited-message-1',
      chatId: 'source-chat-1',
      role: MessageRole.User,
      messageCreatedAt,
      artifacts: [],
      sourceLabel: 'Prior conversation',
      citation: 'The original request.',
    }]);
  });
});
