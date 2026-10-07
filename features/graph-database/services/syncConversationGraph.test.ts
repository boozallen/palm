import { getGraphDatabaseSource } from '@/features/graph-database';
import {
  CONVERSATION_SIDECAR_EMBED_BATCH_SIZE,
  CONVERSATION_SIDECAR_EMBED_MAX_CHARS,
} from '@/features/graph-database/config/conversation-graph.config';
import { syncConversationGraph } from '@/features/graph-database/services/syncConversationGraph';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import db from '@/server/db';
import { logger } from '@/server/logger';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));
jest.mock('@/features/shared/dal/document-library/upload/embedContent', () => ({
  embedContent: jest.fn(),
}));
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn(),
    chat: { findUnique: jest.fn() },
    chatMessage: { findMany: jest.fn() },
    userGroupMembership: { count: jest.fn() },
  },
}));
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    join: jest.fn((values: unknown[]) => ({ strings: [''], values })),
  },
}));

const mockDb = db as unknown as {
  $executeRaw: jest.Mock;
  chat: { findUnique: jest.Mock };
  chatMessage: { findMany: jest.Mock };
  userGroupMembership: { count: jest.Mock };
};
const mockGetGraphDatabaseSource = getGraphDatabaseSource as jest.Mock;
const mockEmbedContent = embedContent as jest.Mock;
const mockLogger = logger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

const chatId = 'chat-1';
const userId = 'user-1';
const messageId = 'message-1';
const chatCreatedAt = new Date('2026-08-05T12:00:00.000Z');
const messageCreatedAt = new Date('2026-08-05T12:01:00.000Z');

const collectedIds = (ids: string[]) => ({
  records: [{ get: jest.fn(() => ids) }],
});
const emptyResult = { records: [] };

const getSqlValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return [value];
  }
  if (typeof value !== 'object' || value === null || !('values' in value)) {
    return [value];
  }

  return (value as { values: unknown[] }).values.flatMap(getSqlValues);
};

const getSqlTemplate = (value: unknown): string => {
  if (typeof value !== 'object' || value === null || !('strings' in value)) {
    return '';
  }
  const { strings, values = [] } = value as { strings: string[], values?: unknown[] };

  // Interleave nested Prisma.sql fragments so SQL written inside value tuples
  // (e.g. to_tsvector around a parameter) is part of the inspected template.
  return strings.reduce(
    (sql, part, index) => sql + part + (index < values.length ? getSqlTemplate(values[index]) : ''),
    '',
  );
};

const baseMessage = {
  id: messageId,
  chatId,
  role: 'assistant',
  content: 'Content remains in Postgres',
  createdAt: messageCreatedAt,
  updatedAt: messageCreatedAt,
  deepResearch: false,
  deepResearchJobId: null,
  deepResearchStatus: null,
  asyncChatJobId: null,
  asyncChatStatus: null,
  progressMessages: null,
  documentIds: [],
  chatMessageCitations: [],
  chatArtifacts: [],
};

describe('syncConversationGraph', () => {
  const graphRun = jest.fn();
  const txRun = jest.fn();
  const txCommit = jest.fn();
  const txRollback = jest.fn();
  const sessionClose = jest.fn();
  const getSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.chat.findUnique.mockResolvedValue({
      id: chatId,
      userId,
      createdAt: chatCreatedAt,
    });
    mockDb.userGroupMembership.count.mockResolvedValue(1);
    mockDb.chatMessage.findMany
      .mockResolvedValueOnce([baseMessage])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);
    txRun.mockResolvedValue(emptyResult);
    graphRun.mockResolvedValue(emptyResult);
    txCommit.mockResolvedValue(undefined);
    txRollback.mockResolvedValue(undefined);
    sessionClose.mockResolvedValue(undefined);
    mockDb.$executeRaw.mockResolvedValue(1);
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    getSession.mockResolvedValue({
      beginTransaction: jest.fn(() => ({
        run: txRun,
        commit: txCommit,
        rollback: txRollback,
      })),
      close: sessionClose,
    });
    mockGetGraphDatabaseSource.mockResolvedValue({
      run: graphRun,
      getSession,
    });
  });

  it('does no graph writes when the chat is missing', async () => {
    mockDb.chat.findUnique.mockResolvedValue(null);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(mockGetGraphDatabaseSource).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Conversation graph: chat not found, skipped',
      { chatId },
    );
  });

  it('does no graph writes when the chat owner has no graph database access', async () => {
    mockDb.userGroupMembership.count.mockResolvedValue(0);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(mockDb.userGroupMembership.count).toHaveBeenCalledWith({
      where: { userId, userGroup: { graphDatabaseEnabled: true } },
    });
    expect(mockGetGraphDatabaseSource).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(txRun).not.toHaveBeenCalled();
    expect(graphRun).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Conversation graph: graph projection skipped, chat owner has no graph database access',
      { chatId, userId },
    );
  });

  // Conversation search is a Postgres feature and must keep working for users without graph
  // access; only the graph projection is theirs to lose. Gating the whole job would silently
  // leave these users unsearchable.
  it('still indexes messages for search when the chat owner has no graph database access', async () => {
    mockDb.userGroupMembership.count.mockResolvedValue(0);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(mockEmbedContent).toHaveBeenCalled();
    const insertQuery = mockDb.$executeRaw.mock.calls
      .map(([query]) => getSqlTemplate(query))
      .find((sql) => sql.includes('INSERT INTO "chat_message_search"'));
    expect(insertQuery).toBeDefined();
  });

  it('propagates graph access lookup errors without doing graph writes', async () => {
    const lookupError = new Error('membership lookup failed');
    mockDb.userGroupMembership.count.mockRejectedValue(lookupError);

    await expect(syncConversationGraph({ chatId, messageIds: [messageId] }))
      .rejects.toBe(lookupError);

    expect(mockGetGraphDatabaseSource).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(txRun).not.toHaveBeenCalled();
    expect(graphRun).not.toHaveBeenCalled();
  });

  it('stamps nodes and edges with the chat owner from the database', async () => {
    const chatOwnerId = 'chat-owner-1';
    mockDb.chat.findUnique.mockResolvedValue({
      id: chatId,
      userId: chatOwnerId,
      createdAt: chatCreatedAt,
    });

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(txRun).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      chatId,
      userId: chatOwnerId,
    }));
    expect(txRun).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      messageId,
      userId: chatOwnerId,
    }));
    expect(txCommit).toHaveBeenCalledTimes(1);
  });

  it('skips and logs an unresolved citation target while linking resolvable targets', async () => {
    const citations = [
      {
        id: 'citation-1',
        graphEntityId: 'entity-found',
        graphConceptId: null,
        embeddingId: null,
      },
      {
        id: 'citation-2',
        graphEntityId: 'entity-missing',
        graphConceptId: null,
        embeddingId: null,
      },
    ];
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([{ ...baseMessage, chatMessageCitations: citations }])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);
    txRun.mockImplementation(async (_query, params) => {
      if (params?.ids) {
        return collectedIds(['entity-found']);
      }
      return emptyResult;
    });

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(txRun).toHaveBeenCalledWith(expect.any(String), {
      ids: ['entity-found', 'entity-missing'],
      messageId,
      userId,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Conversation graph: citation target not found, skipped',
      expect.objectContaining({
        messageId,
        targetIds: ['entity-missing'],
        citationTargets: [{ citationId: 'citation-2', targetId: 'entity-missing' }],
      }),
    );
    expect(txCommit).toHaveBeenCalledTimes(1);
  });

  it('deletes prior message edges before recreating citation edges', async () => {
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([{
        ...baseMessage,
        chatMessageCitations: [{
          id: 'citation-1',
          graphEntityId: 'entity-1',
          graphConceptId: null,
          embeddingId: null,
        }],
      }])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);
    txRun.mockImplementation(async (_query, params) => (
      params?.ids ? collectedIds(params.ids) : emptyResult
    ));

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    const messageOnlyCalls = txRun.mock.calls.filter(([, params]) => (
      Object.keys(params).length === 1 && params.messageId === messageId
    ));
    const deleteEdgesCallOrder = txRun.mock.invocationCallOrder[
      txRun.mock.calls.indexOf(messageOnlyCalls[1])
    ];
    const recreateCallIndex = txRun.mock.calls.findIndex(([, params]) => params.ids);
    expect(deleteEdgesCallOrder).toBeLessThan(txRun.mock.invocationCallOrder[recreateCallIndex]);
  });

  it('upserts produced artifacts using pointer metadata and real persisted ids only', async () => {
    const artifact = {
      id: 'artifact-1',
      label: 'Analysis workbook',
      fileExtension: '.xlsx',
      createdAt: new Date('2026-08-05T12:02:00.000Z'),
    };
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([{ ...baseMessage, chatArtifacts: [artifact] }])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(txRun).toHaveBeenCalledWith(expect.any(String), {
      artifacts: [{
        id: artifact.id,
        label: artifact.label,
        fileExtension: artifact.fileExtension,
        createdAt: artifact.createdAt.toISOString(),
      }],
      messageId,
      userId,
    });
    const artifactWrite = txRun.mock.calls.find(([, params]) => params.artifacts);
    expect(artifactWrite[1].artifacts[0]).not.toHaveProperty('content');
  });

  it('performs bounded orphan cleanup for stale previously linked artifacts', async () => {
    let messageOnlyCallCount = 0;
    txRun.mockImplementation(async (_query, params) => {
      if (Object.keys(params).length === 1 && params.messageId === messageId) {
        messageOnlyCallCount += 1;
        return messageOnlyCallCount === 1
          ? collectedIds(['artifact-stale', 'artifact-current'])
          : emptyResult;
      }
      return emptyResult;
    });
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([{
        ...baseMessage,
        chatArtifacts: [{
          id: 'artifact-current',
          label: 'Current',
          fileExtension: '.txt',
          createdAt: messageCreatedAt,
        }],
      }])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(txRun).toHaveBeenCalledWith(expect.any(String), {
      staleIds: ['artifact-stale'],
    });
  });

  it('writes a user message and IN_CHAT edge without creating reference edges', async () => {
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([{ ...baseMessage, role: 'user' }])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(txRun).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      messageId,
      role: 'user',
      position: 0,
    }));
    expect(txRun.mock.calls.some(([, params]) => params.ids)).toBe(false);
    expect(txRun.mock.calls.some(([, params]) => params.artifacts)).toBe(false);
    expect(txCommit).toHaveBeenCalledTimes(1);
  });

  it('refreshes positions using the full chat ordering', async () => {
    const earlierMessageId = 'message-earlier';
    const laterMessageId = 'message-later';
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([baseMessage])
      .mockResolvedValueOnce([
        { id: earlierMessageId, createdAt: new Date('2026-08-05T12:00:30.000Z') },
        { id: messageId, createdAt: messageCreatedAt },
        { id: laterMessageId, createdAt: new Date('2026-08-05T12:02:00.000Z') },
      ]);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(graphRun).toHaveBeenCalledTimes(1);
    expect(graphRun).toHaveBeenCalledWith(
      expect.stringContaining('UNWIND $positions AS mp'),
      {
        positions: [
          { id: earlierMessageId, position: 0 },
          { id: messageId, position: 1 },
          { id: laterMessageId, position: 2 },
        ],
      },
    );
  });

  it('upserts a search sidecar row deriving the word list and embedding from the same message content', async () => {
    const chatOwnerId = 'chat-owner-1';
    mockDb.chat.findUnique.mockResolvedValue({
      id: chatId,
      userId: chatOwnerId,
      createdAt: chatCreatedAt,
    });

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(mockEmbedContent).toHaveBeenCalledWith([baseMessage.content], chatOwnerId);
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);
    const upsertQuery = mockDb.$executeRaw.mock.calls[0][0];
    const queryValues = getSqlValues(upsertQuery);
    expect(queryValues).toEqual(expect.arrayContaining([
      messageId,
      chatOwnerId,
      baseMessage.content,
      '[0.1,0.2,0.3]',
    ]));
    // The sidecar is a derived index: the message content parameter feeds to_tsvector
    // inside the statement and is never stored as a text column.
    const template = getSqlTemplate(upsertQuery);
    expect(template).toContain('to_tsvector');
    expect(template).toContain('"textSearch"');
    expect(template).not.toContain('"text"');
  });

  it('embeds and upserts search sidecar rows in bounded batches', async () => {
    const messageCount = CONVERSATION_SIDECAR_EMBED_BATCH_SIZE + 1;
    const messages = Array.from({ length: messageCount }, (_, index) => ({
      ...baseMessage,
      id: `message-${index}`,
      content: `Content ${index}`,
      createdAt: new Date(messageCreatedAt.getTime() + index),
    }));
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce(messages)
      .mockResolvedValueOnce(messages.map(({ id, createdAt }) => ({ id, createdAt })));
    mockEmbedContent.mockImplementation(async (texts: string[]) => ({
      embeddings: texts.map(() => ({ embedding: [0.1, 0.2, 0.3] })),
    }));

    await syncConversationGraph({
      chatId,
      messageIds: messages.map(({ id }) => id),
    });

    expect(mockEmbedContent).toHaveBeenCalledTimes(2);
    expect(mockEmbedContent.mock.calls[0][0]).toHaveLength(
      CONVERSATION_SIDECAR_EMBED_BATCH_SIZE,
    );
    expect(mockEmbedContent.mock.calls[1][0]).toHaveLength(1);
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Conversation graph sync completed',
      expect.objectContaining({ sidecarRowsWritten: messageCount }),
    );
  });

  it('bounds embedding input while indexing the complete message text', async () => {
    const completeText = 'x'.repeat(CONVERSATION_SIDECAR_EMBED_MAX_CHARS + 1);
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([{ ...baseMessage, content: completeText }])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(mockEmbedContent).toHaveBeenCalledWith([
      completeText.slice(0, CONVERSATION_SIDECAR_EMBED_MAX_CHARS),
    ], userId);
    // Only the embedding input is bounded; the word list is built from the full text.
    const queryValues = getSqlValues(mockDb.$executeRaw.mock.calls[0][0]);
    expect(queryValues).toContain(completeText);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Conversation graph: message text bounded for sidecar embedding',
      {
        chatId,
        messageId,
        textLength: completeText.length,
        limit: CONVERSATION_SIDECAR_EMBED_MAX_CHARS,
      },
    );
  });

  it('does not embed or write whitespace-only message content', async () => {
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce([{ ...baseMessage, content: ' \n\t ' }])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);
    const deleteQuery = mockDb.$executeRaw.mock.calls[0][0];
    expect(getSqlTemplate(deleteQuery)).toContain('DELETE FROM "chat_message_search"');
    expect(getSqlValues(deleteQuery)).toContainEqual([messageId]);
  });

  it('logs the number of sidecar rows actually deleted for blank messages', async () => {
    const secondMessageId = 'message-2';
    const blankMessages = [
      { ...baseMessage, content: '   ' },
      { ...baseMessage, id: secondMessageId, content: '\n' },
    ];
    mockDb.chatMessage.findMany
      .mockReset()
      .mockResolvedValueOnce(blankMessages)
      .mockResolvedValueOnce(blankMessages.map(({ id, createdAt }) => ({ id, createdAt })));
    mockDb.$executeRaw.mockResolvedValueOnce(1);

    await syncConversationGraph({ chatId, messageIds: [messageId, secondMessageId] });

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);
    const deleteQuery = mockDb.$executeRaw.mock.calls[0][0];
    expect(getSqlTemplate(deleteQuery)).toContain('DELETE FROM "chat_message_search"');
    expect(getSqlValues(deleteQuery)).toContainEqual([messageId, secondMessageId]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Conversation graph sync completed',
      expect.objectContaining({
        sidecarRowsWritten: 0,
        sidecarRowsDeleted: 1,
      }),
    );
  });

  it('propagates embedding failures without writing a sidecar row', async () => {
    const embeddingError = new Error('Embedding failed');
    mockEmbedContent.mockRejectedValue(embeddingError);

    await expect(
      syncConversationGraph({ chatId, messageIds: [messageId] }),
    ).rejects.toBe(embeddingError);

    expect(mockDb.$executeRaw).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Conversation graph: message search sidecar sync failed',
      expect.objectContaining({
        chatId,
        userId,
        messageIds: [messageId],
        error: 'Embedding failed',
        stack: expect.any(String),
      }),
    );
  });

  it('re-running the job issues the same idempotent sidecar upsert', async () => {
    await syncConversationGraph({ chatId, messageIds: [messageId] });
    mockDb.chatMessage.findMany
      .mockResolvedValueOnce([baseMessage])
      .mockResolvedValueOnce([{ id: messageId, createdAt: messageCreatedAt }]);

    await syncConversationGraph({ chatId, messageIds: [messageId] });

    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(2);
    expect(mockDb.$executeRaw.mock.calls[1][0]).toEqual(mockDb.$executeRaw.mock.calls[0][0]);
  });
});
