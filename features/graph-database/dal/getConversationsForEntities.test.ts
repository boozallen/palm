import { getGraphDatabaseSource } from '@/features/graph-database';
import {
  CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT,
  CONVERSATIONS_FOR_ENTITIES_MATCHES_PER_CHAT,
} from '@/features/graph-database/config/conversation-graph.config';
import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';
import getConversationsForEntities from '@/features/graph-database/dal/getConversationsForEntities';
import db from '@/server/db';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));
jest.mock('@/features/graph-database/dal/expandIdentityClusters', () => ({
  expandIdentityClusters: jest.fn(),
}));
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { chat: { findMany: jest.fn() } },
}));
jest.mock('@/server/logger');

const run = jest.fn();
const findMany = db.chat.findMany as jest.Mock;
const mockExpand = expandIdentityClusters as jest.Mock;
const record = (values: Record<string, unknown>) => ({
  get: (key: string) => values[key],
});
const accessibleDocumentIds = new Set(['doc-1', 'doc-2']) as unknown as AccessibleDocIds;

// Default: every seed resolves to just itself (no clusters).
const identityMap = (ids: string[]) => new Map(ids.map((id) => [id, [id]]));

describe('getConversationsForEntities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });
    mockExpand.mockImplementation((ids: string[]) => Promise.resolve(identityMap(ids)));
  });

  it('returns early for an empty id list without touching either database', async () => {
    await expect(getConversationsForEntities({
      userId: 'user-1',
      ids: [],
      accessibleDocumentIds,
    })).resolves.toEqual([]);

    expect(mockExpand).not.toHaveBeenCalled();
    expect(getGraphDatabaseSource).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('queries seeds as-is when no clusters exist, scoped to accessible documents', async () => {
    run.mockResolvedValue({ records: [] });

    await getConversationsForEntities({
      userId: 'user-1',
      ids: ['entity-1', 'concept-1'],
      accessibleDocumentIds,
    });

    const [query, params] = run.mock.calls[0];
    expect(params).toEqual({
      userId: 'user-1',
      documentIds: ['doc-1', 'doc-2'],
      targets: [
        { id: 'entity-1', seedId: 'entity-1' },
        { id: 'concept-1', seedId: 'concept-1' },
      ],
    });
    // Pins the access wall: matched nodes (and the names they carry) must
    // stay inside the caller's accessible documents.
    expect(query).toContain('t.documentId IN $documentIds');
  });

  it('expands seeds through identity clusters scoped to accessible documents', async () => {
    mockExpand.mockResolvedValue(new Map([
      ['entity-1', ['entity-1', 'entity-sibling']],
      ['concept-1', ['concept-1']],
    ]));
    run.mockResolvedValue({ records: [] });

    await getConversationsForEntities({
      userId: 'user-1',
      ids: ['entity-1', 'concept-1'],
      accessibleDocumentIds,
    });

    expect(mockExpand).toHaveBeenCalledWith(['entity-1', 'concept-1'], ['doc-1', 'doc-2']);
    expect(run).toHaveBeenCalledWith(expect.any(String), {
      userId: 'user-1',
      documentIds: ['doc-1', 'doc-2'],
      targets: [
        { id: 'entity-1', seedId: 'entity-1' },
        { id: 'entity-sibling', seedId: 'entity-1' },
        { id: 'concept-1', seedId: 'concept-1' },
      ],
    });
  });

  it('collapses a repeated requested id into one seed and one target', async () => {
    run.mockResolvedValue({ records: [] });

    await getConversationsForEntities({
      userId: 'user-1',
      ids: ['entity-1', 'entity-1'],
      accessibleDocumentIds,
    });

    expect(mockExpand).toHaveBeenCalledWith(['entity-1'], ['doc-1', 'doc-2']);
    const { targets } = run.mock.calls[0][1] as { targets: Array<{ id: string }> };
    expect(targets).toEqual([{ id: 'entity-1', seedId: 'entity-1' }]);
  });

  it('keeps each cluster member as one target when two seeds share a cluster', async () => {
    mockExpand.mockResolvedValue(new Map([
      ['entity-1', ['entity-1', 'entity-2']],
      ['entity-2', ['entity-2', 'entity-1']],
    ]));
    run.mockResolvedValue({ records: [] });

    await getConversationsForEntities({
      userId: 'user-1',
      ids: ['entity-1', 'entity-2'],
      accessibleDocumentIds,
    });

    const { targets } = run.mock.calls[0][1] as { targets: Array<{ id: string }> };
    const targetIds = targets.map(({ id }) => id);
    expect(targetIds).toHaveLength(new Set(targetIds).size);
    expect(new Set(targetIds)).toEqual(new Set(['entity-1', 'entity-2']));
  });

  it('re-scopes chats in Postgres, preserves ordering, and carries target names', async () => {
    run.mockResolvedValue({
      records: [
        record({
          chatId: 'chat-high',
          distinctTargets: 2,
          totalMatches: 2,
          matches: [
            { messageId: 'message-1', position: 3, targetId: 'entity-1', targetName: 'Shield AI' },
            { messageId: 'message-2', position: 4, targetId: 'concept-1', targetName: 'Zero Trust' },
          ],
        }),
        record({
          chatId: 'chat-foreign',
          distinctTargets: 1,
          totalMatches: 1,
          matches: [
            { messageId: 'message-3', position: 1, targetId: 'entity-1', targetName: 'Shield AI' },
          ],
        }),
        record({
          chatId: 'chat-low',
          distinctTargets: { toNumber: () => 1 },
          totalMatches: { toNumber: () => 1 },
          matches: [{
            messageId: 'message-4',
            position: { toNumber: () => 8 },
            targetId: 'entity-1',
            targetName: null,
          }],
        }),
      ],
    });
    findMany.mockResolvedValue([
      { id: 'chat-low', summary: null },
      { id: 'chat-high', summary: 'Top result' },
    ]);

    const result = await getConversationsForEntities({
      userId: 'user-1',
      ids: ['entity-1', 'concept-1'],
      accessibleDocumentIds,
    });

    const [query, params] = run.mock.calls[0];
    expect(query).toContain(`LIMIT ${CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT}`);
    expect(query).toContain(
      `matches[0..${CONVERSATIONS_FOR_ENTITIES_MATCHES_PER_CHAT}] AS matches`,
    );
    expect(params).not.toHaveProperty('chatLimit');
    expect(params).not.toHaveProperty('matchesPerChat');
    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chat-high', 'chat-foreign', 'chat-low'] },
        userId: 'user-1',
      },
      select: { id: true, summary: true },
    });
    expect(result.map(({ chatId }) => chatId)).toEqual(['chat-high', 'chat-low']);
    expect(result[0]?.matches[0]).toEqual({
      messageId: 'message-1',
      position: 3,
      targetId: 'entity-1',
      targetName: 'Shield AI',
    });
    expect(result[1]).toEqual({
      chatId: 'chat-low',
      title: null,
      distinctTargets: 1,
      totalMatches: 1,
      matches: [{ messageId: 'message-4', position: 8, targetId: 'entity-1', targetName: null }],
    });
  });

  it('reports when the conversation cap is reached and preserves pre-slice match totals', async () => {
    run.mockResolvedValue({
      records: Array.from({ length: CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT }, (_, index) => (
        record({
          chatId: `chat-${index}`,
          distinctTargets: 1,
          totalMatches: 25,
          matches: Array.from(
            { length: CONVERSATIONS_FOR_ENTITIES_MATCHES_PER_CHAT },
            (_value, matchIndex) => ({
              messageId: `message-${index}-${matchIndex}`,
              position: matchIndex,
              targetId: 'entity-1',
              targetName: 'Shield AI',
            }),
          ),
        })
      )),
    });
    findMany.mockResolvedValue(Array.from(
      { length: CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT },
      (_, index) => ({ id: `chat-${index}`, summary: null }),
    ));

    const result = await getConversationsForEntities({
      userId: 'user-1',
      ids: ['entity-1'],
      accessibleDocumentIds,
    });

    expect(result).toHaveLength(CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT);
    expect(result[0]?.totalMatches).toBe(25);
    expect(result[0]?.matches).toHaveLength(CONVERSATIONS_FOR_ENTITIES_MATCHES_PER_CHAT);
    expect(logger.info).toHaveBeenCalledWith(
      'Conversation entity lookup hit conversation limit',
      { userId: 'user-1', limit: CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT },
    );
  });

  it('logs internal failures and throws a sanitized error', async () => {
    const error = new Error('Neo4j password');
    run.mockRejectedValue(error);

    await expect(getConversationsForEntities({
      userId: 'user-1',
      ids: ['entity-1'],
      accessibleDocumentIds,
    })).rejects.toThrow('Error finding conversations for entities');

    expect(logger.error).toHaveBeenCalledWith(
      'Error finding conversations for entities',
      { userId: 'user-1', error },
    );
  });
});
