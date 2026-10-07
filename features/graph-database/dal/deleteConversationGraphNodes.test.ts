import { getGraphDatabaseSource } from '@/features/graph-database';
import {
  deleteConversationNodesForChat,
  deleteConversationNodesForMessages,
} from '@/features/graph-database/dal/deleteConversationGraphNodes';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { logger } from '@/server/logger';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));
jest.mock('@/server/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('deleteConversationGraphNodes', () => {
  const run = jest.fn();
  const userId = 'user-1';
  const graphResult = (nodesDeleted: number) => ({
    records: [],
    summary: {
      counters: {
        updates: () => ({
          relationshipsDeleted: 0,
          nodesDeleted,
          nodesCreated: 0,
          relationshipsCreated: 0,
        }),
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });
    run.mockResolvedValue(graphResult(1));
  });

  it('deletes a chat, messages selected by chatId, and only orphaned artifacts', async () => {
    await deleteConversationNodesForChat('chat-1', userId);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('MATCH (m:Message {chatId: $chatId, userId: $userId})'),
      { chatId: 'chat-1', userId },
    );
    const messageDeleteQuery = run.mock.calls[0][0] as string;
    expect(messageDeleteQuery).not.toContain('[:IN_CHAT]');
    expect(messageDeleteQuery).toContain('DETACH DELETE m');
    expect(messageDeleteQuery).toContain(
      'OPTIONAL MATCH (m)-[:PRODUCED]->(a:Artifact {userId: $userId})',
    );
    expect(messageDeleteQuery).toContain(
      'NOT (:Message {userId: $userId})-[:PRODUCED]->(a)',
    );
    expect(messageDeleteQuery).toContain('IN TRANSACTIONS OF 1000 ROWS');
    expect(run).toHaveBeenNthCalledWith(
      2,
      'MATCH (c:Chat {id: $chatId, userId: $userId}) DETACH DELETE c',
      { chatId: 'chat-1', userId },
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps artifacts that are still produced by a surviving message', async () => {
    await deleteConversationNodesForMessages(['message-1'], userId);

    const query = run.mock.calls[0][0] as string;
    expect(query).toContain('DETACH DELETE m');
    expect(query).toContain('MATCH (m:Message {id: messageId, userId: $userId})');
    expect(query).toContain(
      'OPTIONAL MATCH (m)-[:PRODUCED]->(a:Artifact {userId: $userId})',
    );
    expect(query).toContain('NOT (:Message {userId: $userId})-[:PRODUCED]->(a)');
    expect(query.indexOf('DETACH DELETE m')).toBeLessThan(
      query.indexOf('NOT (:Message {userId: $userId})-[:PRODUCED]->(a)'),
    );
    expect(run).toHaveBeenCalledWith(expect.any(String), {
      messageIds: ['message-1'],
      userId,
    });
  });

  it('does nothing for an empty message id list', async () => {
    await deleteConversationNodesForMessages([], userId);

    expect(getGraphDatabaseSource).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('warns when the asserted owner does not match any chat nodes', async () => {
    run.mockResolvedValue(graphResult(0));

    await deleteConversationNodesForChat('chat-1', 'wrong-user');

    expect(run).toHaveBeenNthCalledWith(1, expect.any(String), {
      chatId: 'chat-1',
      userId: 'wrong-user',
    });
    expect(run).toHaveBeenNthCalledWith(2, expect.any(String), {
      chatId: 'chat-1',
      userId: 'wrong-user',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Conversation graph chat delete matched no nodes',
      { chatId: 'chat-1', userId: 'wrong-user' },
    );
  });

  it('warns when the asserted owner does not match any message nodes', async () => {
    run.mockResolvedValue(graphResult(0));

    await deleteConversationNodesForMessages(['message-1'], 'wrong-user');

    expect(run).toHaveBeenCalledWith(expect.any(String), {
      messageIds: ['message-1'],
      userId: 'wrong-user',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Conversation graph message delete matched no nodes',
      { messageIds: ['message-1'], userId: 'wrong-user' },
    );
  });

  it('surfaces a sanitized retryable chat cleanup error after retrying', async () => {
    run.mockRejectedValue(new Error('Neo4j connection details'));

    await expect(retryWithBackoff(
      () => deleteConversationNodesForChat('chat-1', userId),
      { maxRetries: 1, initialDelayMs: 0 },
    )).rejects.toThrow('Error deleting conversation graph nodes');

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('surfaces a sanitized retryable message cleanup error after retrying', async () => {
    run.mockRejectedValue(new Error('Neo4j connection details'));

    await expect(retryWithBackoff(
      () => deleteConversationNodesForMessages(['message-1'], userId),
      { maxRetries: 1, initialDelayMs: 0 },
    )).rejects.toThrow('Error deleting conversation graph nodes');

    expect(run).toHaveBeenCalledTimes(2);
  });
});
