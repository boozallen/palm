import getChatRequestExcerpts from '@/features/context-studio/dal/getChatRequestExcerpts';
import db from '@/server/db';

jest.mock('@/server/db', () => ({ __esModule: true, default: { $queryRaw: jest.fn() } }));
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    join: jest.fn((arr: unknown[]) => arr),
  },
}));
jest.mock('@/server/logger');

const queryRaw = db.$queryRaw as jest.Mock;

const row = (chatId: string, position: number, content: string) => ({
  chatId,
  position: BigInt(position),
  content,
});

describe('getChatRequestExcerpts', () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('asks the database for nothing when there are no chats', async () => {
    const result = await getChatRequestExcerpts([]);

    expect(result.size).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  // A bound JS number reaches Postgres as bigint, and left() has no bigint
  // overload, so without the casts the query fails and no chat gets an excerpt.
  it('casts the bound lengths so the query runs at all', async () => {
    queryRaw.mockResolvedValue([]);

    await getChatRequestExcerpts(['chat-1']);

    const sql = (queryRaw.mock.calls[0][0] as string[]).join('?');

    expect(sql).toContain('left(cm.content, ?::int)');
    expect(sql).toContain('position <= ?::int');
  });

  it('carries what the person asked for first', async () => {
    queryRaw.mockResolvedValue([
      row('chat-1', 1, 'Draft the past performance narrative for the Harbor Authority ERP recompete'),
    ]);

    const result = await getChatRequestExcerpts(['chat-1']);

    expect(result.get('chat-1')).toEqual([
      'Draft the past performance narrative for the Harbor Authority ERP recompete',
    ]);
  });

  // The case a chat title cannot cover: a generic opening, the pursuit named later.
  it('also carries a later message that names a pursuit', async () => {
    queryRaw.mockResolvedValue([
      row('chat-1', 1, 'Help me brainstorm win themes'),
      row('chat-1', 2, 'Which of these is strongest?'),
      row('chat-1', 3, 'This is for the Cascade County RFI, due Friday'),
    ]);

    const result = await getChatRequestExcerpts(['chat-1']);

    expect(result.get('chat-1')).toEqual([
      'Help me brainstorm win themes',
      'This is for the Cascade County RFI, due Friday',
    ]);
  });

  it('leaves a chat with nothing pursuit-related at its opening ask alone', async () => {
    queryRaw.mockResolvedValue([
      row('chat-1', 1, 'Summarize this spreadsheet'),
      row('chat-1', 2, 'Now chart it'),
    ]);

    const result = await getChatRequestExcerpts(['chat-1']);

    expect(result.get('chat-1')).toEqual(['Summarize this spreadsheet']);
  });

  it('shortens a long message and collapses its line breaks', async () => {
    queryRaw.mockResolvedValue([row('chat-1', 1, `Review\n\nthis   ${'x'.repeat(400)}`)]);

    const excerpt = (await getChatRequestExcerpts(['chat-1'])).get('chat-1')?.[0] ?? '';

    expect(excerpt.startsWith('Review this x')).toBe(true);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(201);
  });

  it('skips a chat whose messages are all empty rather than quoting a blank', async () => {
    queryRaw.mockResolvedValue([row('chat-1', 1, '   '), row('chat-2', 1, 'A real question')]);

    const result = await getChatRequestExcerpts(['chat-1', 'chat-2']);

    expect(result.has('chat-1')).toBe(false);
    expect(result.get('chat-2')).toEqual(['A real question']);
  });

  it('keeps each chat to its own excerpts', async () => {
    queryRaw.mockResolvedValue([
      row('chat-1', 1, 'Harbor Authority pricing volume'),
      row('chat-2', 1, 'Cascade County capability statement'),
    ]);

    const result = await getChatRequestExcerpts(['chat-1', 'chat-2']);

    expect(result.get('chat-1')).toEqual(['Harbor Authority pricing volume']);
    expect(result.get('chat-2')).toEqual(['Cascade County capability statement']);
  });

  it('reports a failure rather than returning a partial map', async () => {
    queryRaw.mockRejectedValue(new Error('boom'));

    await expect(getChatRequestExcerpts(['chat-1'])).rejects.toThrow('Failed to fetch chat request excerpts');
  });
});
