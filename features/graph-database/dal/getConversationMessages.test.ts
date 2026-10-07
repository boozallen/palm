import getConversationMessages from '@/features/graph-database/dal/getConversationMessages';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chat: { findFirst: jest.fn() },
    chatMessage: { count: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('@/server/logger');

const findFirst = db.chat.findFirst as jest.Mock;
const countMessages = db.chatMessage.count as jest.Mock;
const findMessages = db.chatMessage.findMany as jest.Mock;
const messages = [
  {
    id: 'message-a',
    role: 'user',
    content: 'First',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    chatArtifacts: [],
  },
  {
    id: 'message-b',
    role: 'assistant',
    content: `  ${'Full response '.repeat(100)}  `,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    chatArtifacts: [{
      id: 'artifact-1',
      label: 'Analysis',
      fileExtension: '.xlsx',
      createdAt: new Date('2026-08-01T11:00:00.000Z'),
    }],
  },
  {
    id: 'message-c',
    role: 'user',
    content: 'Third',
    createdAt: new Date('2026-08-02T10:00:00.000Z'),
    chatArtifacts: [],
  },
];

describe('getConversationMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue({
      id: 'chat-1',
      summary: 'A prior chat',
    });
    countMessages.mockResolvedValue(messages.length);
    findMessages.mockImplementation(({ skip, take }) => (
      Promise.resolve(messages.slice(skip, skip + take))
    ));
  });

  it('derives positions from createdAt and id ordering and returns full text and artifacts', async () => {
    const result = await getConversationMessages({
      userId: 'user-1',
      chatId: 'chat-1',
      startPosition: 1,
      endPosition: 1,
    });

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'chat-1',
        userId: 'user-1',
      },
      select: { id: true, summary: true },
    }));
    expect(countMessages).toHaveBeenCalledWith({ where: { chatId: 'chat-1' } });
    expect(findMessages).toHaveBeenCalledWith({
      where: { chatId: 'chat-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 1,
      take: 1,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        chatArtifacts: {
          select: {
            id: true,
            label: true,
            fileExtension: true,
            createdAt: true,
          },
        },
      },
    });
    expect(result).toEqual({
      chatId: 'chat-1',
      title: 'A prior chat',
      messageCount: 3,
      messages: [{
        messageId: 'message-b',
        position: 1,
        role: 'assistant',
        text: messages[1].content,
        createdAt: messages[1].createdAt,
        artifacts: messages[1].chatArtifacts,
      }],
    });
  });

  it.each([
    ['omitted bounds', undefined, undefined, [0, 1, 2]],
    ['clamped bounds', 0, 99, [0, 1, 2]],
    ['out-of-range start', 99, undefined, []],
    ['inverted bounds', 2, 1, []],
  ])('handles %s', async (_label, startPosition, endPosition, expectedPositions) => {
    const result = await getConversationMessages({
      userId: 'user-1',
      chatId: 'chat-1',
      ...(startPosition === undefined ? {} : { startPosition }),
      ...(endPosition === undefined ? {} : { endPosition }),
    });

    expect(result.messages.map(({ position }) => position)).toEqual(expectedPositions);
    if (expectedPositions.length === 0) {
      expect(findMessages).not.toHaveBeenCalled();
    }
  });

  it('does not query messages for an empty chat', async () => {
    countMessages.mockResolvedValue(0);

    await expect(getConversationMessages({
      userId: 'user-1',
      chatId: 'chat-1',
    })).resolves.toEqual({
      chatId: 'chat-1',
      title: 'A prior chat',
      messageCount: 0,
      messages: [],
    });

    expect(findMessages).not.toHaveBeenCalled();
  });

  it.each(['wrong-owner', 'opted-out'])('returns not found for a %s conversation', async () => {
    findFirst.mockResolvedValue(null);

    await expect(getConversationMessages({
      userId: 'user-1',
      chatId: 'chat-1',
    })).rejects.toThrow('Conversation not found');

    expect(logger.warn).toHaveBeenCalledWith(
      'Conversation not found',
      { userId: 'user-1', chatId: 'chat-1' },
    );
    expect(countMessages).not.toHaveBeenCalled();
    expect(findMessages).not.toHaveBeenCalled();
  });

  it('sanitizes unexpected database errors', async () => {
    const error = new Error('private database details');
    countMessages.mockRejectedValue(error);

    await expect(getConversationMessages({
      userId: 'user-1',
      chatId: 'chat-1',
    })).rejects.toThrow('Error getting conversation messages');

    expect(logger.error).toHaveBeenCalledWith(
      'Error getting conversation messages',
      { userId: 'user-1', chatId: 'chat-1', error },
    );
  });
});
