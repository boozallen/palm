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
          createdAt: mockMessage.chatArtifacts[0].createdAt,
        },
      ],
      followUps: [],
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
});
