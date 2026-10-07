import deleteMessagesSince from '@/features/chat/dal/deleteMessagesSince';
import { deleteConversationNodesForMessages } from '@/features/graph-database/dal/deleteConversationGraphNodes';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/features/graph-database/dal/deleteConversationGraphNodes', () => ({
  deleteConversationNodesForMessages: jest.fn(),
}));
jest.mock('@/features/graph-database/utils/retryWithBackoff', () => ({
  retryWithBackoff: jest.fn((fn: () => Promise<unknown>) => fn()),
}));
jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatMessage: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock('@/server/logger');

describe('deleteMessagesSince', () => {
  const since = new Date('2026-08-01T00:00:00.000Z');
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    (db.chatMessage.findMany as jest.Mock).mockResolvedValue([
      { id: 'message-1' },
      { id: 'message-2' },
    ]);
    (db.chatMessage.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
    (deleteConversationNodesForMessages as jest.Mock).mockResolvedValue(undefined);
  });

  it('captures ids and retries graph cleanup before and after the PostgreSQL delete', async () => {
    await expect(deleteMessagesSince('chat-1', since, userId)).resolves.toEqual([
      'message-1',
      'message-2',
    ]);

    expect(db.chatMessage.findMany).toHaveBeenCalledWith({
      where: { chatId: 'chat-1', createdAt: { gte: since } },
      select: { id: true },
    });
    expect(deleteConversationNodesForMessages).toHaveBeenNthCalledWith(1, [
      'message-1',
      'message-2',
    ], userId);
    expect(deleteConversationNodesForMessages).toHaveBeenNthCalledWith(2, [
      'message-1',
      'message-2',
    ], userId);
    expect(retryWithBackoff).toHaveBeenCalledTimes(2);
    expect((db.chatMessage.findMany as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (deleteConversationNodesForMessages as jest.Mock).mock.invocationCallOrder[0],
    );
    expect((deleteConversationNodesForMessages as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (db.chatMessage.deleteMany as jest.Mock).mock.invocationCallOrder[0],
    );
    expect((db.chatMessage.deleteMany as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (deleteConversationNodesForMessages as jest.Mock).mock.invocationCallOrder[1],
    );
  });

  it('blocks the PostgreSQL delete on a graph failure when the flag is on', async () => {
    const error = new Error('Neo4j unavailable');
    (deleteConversationNodesForMessages as jest.Mock).mockRejectedValue(error);

    await expect(deleteMessagesSince('chat-1', since, userId)).rejects.toThrow(
      'Neo4j unavailable',
    );

    expect(db.chatMessage.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes from PostgreSQL despite graph failures when the flag is off', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);
    const error = new Error('Neo4j unavailable');
    (deleteConversationNodesForMessages as jest.Mock).mockRejectedValue(error);

    await expect(deleteMessagesSince('chat-1', since, userId)).resolves.toEqual([
      'message-1',
      'message-2',
    ]);

    expect(deleteConversationNodesForMessages).toHaveBeenCalledTimes(2);
    expect(retryWithBackoff).not.toHaveBeenCalled();
    expect(db.chatMessage.deleteMany).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not clean conversation graph before deleting messages while feature is off',
      {
        chatId: 'chat-1',
        messageIds: ['message-1', 'message-2'],
        error,
      },
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Error cleaning conversation graph after deleting messages',
      {
        chatId: 'chat-1',
        messageIds: ['message-1', 'message-2'],
        error,
      },
    );
  });

  it('does not surface a second-pass graph cleanup failure', async () => {
    const error = new Error('Neo4j unavailable after deletion');
    (deleteConversationNodesForMessages as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error);

    await expect(deleteMessagesSince('chat-1', since, userId)).resolves.toEqual([
      'message-1',
      'message-2',
    ]);

    expect(db.chatMessage.deleteMany).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Error cleaning conversation graph after deleting messages',
      {
        chatId: 'chat-1',
        messageIds: ['message-1', 'message-2'],
        error,
      },
    );
  });
});
