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
      chatMessageCitations: [],
      chatArtifacts: [],
    },
    {
      id: '492668b6-274d-40eb-be5b-5c255147e888',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'Hi there!',
      createdAt: new Date(),
      chatMessageCitations: [
        {
          knowledgeBaseId: '2e2dbcb4-c222-42ea-9642-77c1c1d5bb12',
          knowledgeBase: { label: 'Knowledge Base 1' },
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
          createdAt: new Date(),
        },
      ],
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
          },
        },
        chatArtifacts: true,
      },
    });

    expect(result).toEqual([
      {
        id: mockMessages[0].id,
        chatId: mockChatId,
        role: mockMessages[0].role,
        content: mockMessages[0].content,
        createdAt: expect.any(Date),
        citations: [],
        artifacts: [],
      },
      {
        id: mockMessages[1].id,
        chatId: mockChatId,
        role: mockMessages[1].role,
        content: mockMessages[1].content,
        createdAt: expect.any(Date),
        citations: [
          {
            knowledgeBaseId: mockMessages[1].chatMessageCitations[0].knowledgeBaseId,
            knowledgeBaseLabel: mockMessages[1].chatMessageCitations[0].knowledgeBase.label,
            citation: mockMessages[1].chatMessageCitations[0].citation,
          },
        ],
        artifacts: [
          {
            id: mockMessages[1].chatArtifacts[0].id,
            fileExtension: mockMessages[1].chatArtifacts[0].fileExtension,
            label: mockMessages[1].chatArtifacts[0].label,
            content: mockMessages[1].chatArtifacts[0].content,
            chatMessageId: mockMessages[1].chatArtifacts[0].chatMessageId,
            createdAt: expect.any(Date),
          },
        ],
      },
    ]);
  });

  it('logs an error and throws an exception if a database error occurs', async () => {
    const mockError = new Error('Database error');
    (db.chatMessage.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getMessages(mockChatId)).rejects.toThrow('Error fetching messages');

    expect(logger.error).toHaveBeenCalledWith(`Error fetching messages from the database. ChatId: ${mockChatId}`, mockError);
  });
});
