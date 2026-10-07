import db from '@/server/db';
import logger from '@/server/logger';
import getPageTransitions from './getPageTransitions';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

const pair = (from: string, to: string, n: number) => ({ from_page: from, to_page: to, n });

describe('getPageTransitions', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // db.$queryRaw is a tagged template call, so Jest still receives the real
  // "cooked" strings array even though the mock does nothing with it. A single
  // backslash in the source (`\(`) is an unrecognized JS escape and gets
  // silently dropped before this string exists — leaving Postgres an
  // unbalanced regex that captures the href with a leading "(" attached. Only
  // a double backslash in the source survives as one real backslash here.
  it('keeps a real backslash before the href-capture parens, not a JS-escaped literal', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getPageTransitions(TimeRange.Week, userGroupId, userId);

    const [strings] = (db.$queryRaw as jest.Mock).mock.calls[0];
    expect(Array.from(strings).join('')).toContain('\\(([^)]+)\\)');
  });

  it('builds a from/to matrix keyed by page', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      pair('Chat', 'Library', 5),
      pair('Library', 'Chat', 2),
    ]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.matrix.Chat.Library).toBe(5);
    expect(result.matrix.Library.Chat).toBe(2);
    expect(result.totalTransitions).toBe(7);
  });

  it('gives every page a row so the client never reads an undefined row', async () => {
    // Prompts is only ever a destination, never a source.
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([pair('Chat', 'Prompts', 3)]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.pages).toContain('Prompts');
    expect(result.matrix.Prompts).toEqual({});
  });

  it('ranks pages by total traffic across both endpoints', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      pair('Chat', 'Library', 10),
      pair('Prompts', 'Settings', 1),
    ]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.pages.slice(0, 2).sort()).toEqual(['Chat', 'Library']);
  });

  it('covers every page with no top-N cutoff or Other bucket', async () => {
    // Ten distinct source pages, each with its own destination — comprehensive
    // means all twenty pages show up, not just the busiest handful.
    const rows = Array.from({ length: 10 }, (_, i) => pair(`From${i}`, `To${i}`, 20 - i));
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce(rows);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.pages).toHaveLength(20);
    expect(result.pages).not.toContain('Other');
    const summed = Object.values(result.matrix)
      .flatMap((row) => Object.values(row))
      .reduce((sum, n) => sum + n, 0);
    expect(summed).toBe(result.totalTransitions);
  });

  it('returns an empty matrix for a range with no transitions', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result).toEqual({
      pages: [],
      matrix: {},
      totalTransitions: 0,
    });
  });

  it('collapses a per-resource route to its root page', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      pair('/library/f47ac10b-58cc/edit', '/chat/9c1e2b3a', 4),
    ]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.matrix['/library']['/chat']).toBe(4);
    expect(result.pages).toEqual(expect.arrayContaining(['/library', '/chat']));
  });

  it('keeps a static two-segment path distinct from its siblings', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      pair('/settings/ai-agents', '/settings/databases', 2),
    ]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.matrix['/settings/ai-agents']['/settings/databases']).toBe(2);
  });

  it('merges same-page hash-fragment tab switches into their parent path', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      pair('/settings#profile', '/chat', 2),
      pair('/settings#security', '/chat', 3),
    ]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.matrix['/settings']['/chat']).toBe(5);
  });

  it('strips a query string before bucketing', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      pair('/context-studio?tab=activity', '/chat', 1),
    ]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.matrix['/context-studio']['/chat']).toBe(1);
  });

  it('logs and rethrows a sanitized error when the query fails', async () => {
    const error = new Error('Database error');
    (db.$queryRaw as jest.Mock).mockRejectedValue(error);

    await expect(getPageTransitions(TimeRange.Week, userGroupId, userId))
      .rejects.toThrow('Failed to fetch page transition statistics');

    expect(logger.error).toHaveBeenCalledWith('Error fetching page transitions', { error });
  });
});
