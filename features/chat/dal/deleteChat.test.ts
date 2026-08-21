import deleteChat from '@/features/chat/dal/deleteChat';
import { deleteConversationNodesForChat } from '@/features/graph-database/dal/deleteConversationGraphNodes';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/features/graph-database/dal/deleteConversationGraphNodes', () => ({
  deleteConversationNodesForChat: jest.fn(),
}));
jest.mock('@/features/graph-database/utils/retryWithBackoff', () => ({
  retryWithBackoff: jest.fn((fn: () => Promise<unknown>) => fn()),
}));
jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { chat: { delete: jest.fn() } },
}));
jest.mock('@/server/logger');

describe('deleteChat', () => {
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    (db.chat.delete as jest.Mock).mockResolvedValue(undefined);
    (deleteConversationNodesForChat as jest.Mock).mockResolvedValue(undefined);
  });

  it('retries graph cleanup before and after deleting the chat from PostgreSQL', async () => {
    await deleteChat('chat-1', userId);

    expect(retryWithBackoff).toHaveBeenCalledTimes(2);
    expect(deleteConversationNodesForChat).toHaveBeenNthCalledWith(1, 'chat-1', userId);
    expect(deleteConversationNodesForChat).toHaveBeenNthCalledWith(2, 'chat-1', userId);
    expect((deleteConversationNodesForChat as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (db.chat.delete as jest.Mock).mock.invocationCallOrder[0],
    );
    expect((db.chat.delete as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (deleteConversationNodesForChat as jest.Mock).mock.invocationCallOrder[1],
    );
  });

  it('blocks the PostgreSQL delete on a graph failure when the flag is on', async () => {
    const error = new Error('Neo4j unavailable');
    (deleteConversationNodesForChat as jest.Mock).mockRejectedValue(error);

    await expect(deleteChat('chat-1', userId)).rejects.toThrow('Neo4j unavailable');

    expect(db.chat.delete).not.toHaveBeenCalled();
  });

  it('deletes from PostgreSQL despite graph failures when the flag is off', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);
    const error = new Error('Neo4j unavailable');
    (deleteConversationNodesForChat as jest.Mock).mockRejectedValue(error);

    await expect(deleteChat('chat-1', userId)).resolves.toBeUndefined();

    expect(deleteConversationNodesForChat).toHaveBeenCalledTimes(2);
    expect(retryWithBackoff).not.toHaveBeenCalled();
    expect(db.chat.delete).toHaveBeenCalledWith({ where: { id: 'chat-1' } });
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not clean conversation graph before deleting chat while feature is off',
      { chatId: 'chat-1', error },
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Error cleaning conversation graph after deleting chat',
      { chatId: 'chat-1', error },
    );
  });

  it('does not surface a second-pass graph cleanup failure', async () => {
    const error = new Error('Neo4j unavailable after deletion');
    (deleteConversationNodesForChat as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error);

    await expect(deleteChat('chat-1', userId)).resolves.toBeUndefined();

    expect(db.chat.delete).toHaveBeenCalledWith({ where: { id: 'chat-1' } });
    expect(logger.error).toHaveBeenCalledWith(
      'Error cleaning conversation graph after deleting chat',
      { chatId: 'chat-1', error },
    );
  });
});
