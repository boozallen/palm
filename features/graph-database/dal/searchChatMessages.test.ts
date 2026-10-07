import searchChatMessages, {
  ChatMessageSearchRow,
} from '@/features/graph-database/dal/searchChatMessages';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { $queryRaw: jest.fn() },
}));
jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Jest loads the browser build of Prisma; provide a working Prisma.sql tag.
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    empty: Symbol('empty'),
  },
}));

const mockQueryRaw = (db as unknown as { $queryRaw: jest.Mock }).$queryRaw;
const mockLogger = logger as unknown as {
  info: jest.Mock;
  error: jest.Mock;
};

const getSqlValues = (value: unknown): unknown[] => {
  if (typeof value !== 'object' || value === null || !('values' in value)) {
    return [value];
  }

  return (value as { values: unknown[] }).values.flatMap(getSqlValues);
};

const baseRow: ChatMessageSearchRow = {
  messageId: 'message-1',
  chatId: 'chat-1',
  chatSummary: 'Procurement notes',
  role: 'assistant',
  text: 'Full message text',
  createdAt: new Date('2026-08-05T12:01:00.000Z'),
  similarity: 0.8,
  textRank: null,
};

describe('searchChatMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps a lexical-only row with no vector similarity', async () => {
    const lexicalRow = { ...baseRow, similarity: null, textRank: 0.7 };
    mockQueryRaw.mockResolvedValue([lexicalRow]);

    const rows = await searchChatMessages({
      userId: 'user-1',
      queryText: 'RFP-2026-014',
      limit: 10,
    });

    expect(rows).toEqual([lexicalRow]);
  });

  it('drops a vector row below the similarity floor when it has no text rank', async () => {
    mockQueryRaw.mockResolvedValue([{ ...baseRow, similarity: 0.3, textRank: null }]);

    const rows = await searchChatMessages({
      userId: 'user-1',
      embedding: [0.1, 0.2],
      limit: 10,
    });

    expect(rows).toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Conversation message search relevance floor dropped rows',
      expect.objectContaining({ beforeCount: 1, afterCount: 0, threshold: 0.45 }),
    );
  });

  it('keeps a vector row above the similarity floor', async () => {
    const vectorRow = { ...baseRow, similarity: 0.7, textRank: null };
    mockQueryRaw.mockResolvedValue([vectorRow]);

    const rows = await searchChatMessages({
      userId: 'user-1',
      embedding: [0.1, 0.2],
      limit: 10,
    });

    expect(rows).toEqual([vectorRow]);
  });

  it('binds the user and excluded chat ids when an exclusion is supplied', async () => {
    const scopedUserId = 'user-scoped';
    const excludedChatId = 'chat-excluded';
    mockQueryRaw.mockResolvedValue([]);

    await searchChatMessages({
      userId: scopedUserId,
      queryText: 'procurement',
      excludeChatId: excludedChatId,
      limit: 10,
    });

    const queryValues = getSqlValues(mockQueryRaw.mock.calls[0][0]);
    expect(queryValues).toContain(scopedUserId);
    expect(queryValues).toContain(excludedChatId);
  });

  it('binds the user id without binding an omitted excluded chat id', async () => {
    const scopedUserId = 'user-scoped';
    const excludedChatId = 'chat-excluded';
    mockQueryRaw.mockResolvedValue([]);

    await searchChatMessages({
      userId: scopedUserId,
      queryText: 'procurement',
      limit: 10,
    });

    const queryValues = getSqlValues(mockQueryRaw.mock.calls[0][0]);
    expect(queryValues).toContain(scopedUserId);
    expect(queryValues).not.toContain(excludedChatId);
  });

  it('returns without querying when neither search arm has input', async () => {
    const rows = await searchChatMessages({ userId: 'user-1', limit: 10 });

    expect(rows).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('rejects an embedding containing NaN without querying', async () => {
    await expect(searchChatMessages({
      userId: 'user-1',
      embedding: [0.1, Number.NaN],
      limit: 10,
    })).rejects.toThrow('Error searching chat messages');

    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('returns message text byte-for-byte without truncation', async () => {
    const exactText = '  First line\nSecond line\u0000after-null-marker  ';
    mockQueryRaw.mockResolvedValue([{ ...baseRow, text: exactText }]);

    const rows = await searchChatMessages({
      userId: 'user-1',
      queryText: 'Second line',
      limit: 10,
    });

    expect(rows[0].text).toBe(exactText);
  });

  it('logs DAL errors and rethrows a sanitized error', async () => {
    const internalError = new Error('database host and credentials leaked');
    mockQueryRaw.mockRejectedValue(internalError);

    await expect(searchChatMessages({
      userId: 'user-1',
      queryText: 'procurement',
      limit: 10,
    })).rejects.toThrow('Error searching chat messages');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error searching chat messages',
      { userId: 'user-1', error: internalError },
    );
  });
});
