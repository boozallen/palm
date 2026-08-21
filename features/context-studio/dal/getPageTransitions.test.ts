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

  it('folds pages beyond the top eight into a single Other row and column', async () => {
    // Ten distinct source pages, each with its own destination, so the top-eight
    // cut leaves a tail on both axes.
    const rows = Array.from({ length: 10 }, (_, i) => pair(`From${i}`, `To${i}`, 20 - i));
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce(rows);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.pages).toHaveLength(9);
    expect(result.pages[8]).toBe('Other');
    // Nothing is lost to the fold: every transition still lands in some cell.
    const summed = Object.values(result.matrix)
      .flatMap((row) => Object.values(row))
      .reduce((sum, n) => sum + n, 0);
    expect(summed).toBe(result.totalTransitions);
  });

  it('sums collisions when two folded pages share a destination', async () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => pair(`Top${i}`, `Top${i}`, 100 - i)),
      pair('TailA', 'Top0', 3),
      pair('TailB', 'Top0', 4),
    ];
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce(rows);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.matrix.Other.Top0).toBe(7);
  });

  it('abbreviates a long column label by clipping its trailing word', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([pair('Prompt Library', 'Chat', 1)]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.shortLabels['Prompt Library']).toBe('Prompt Lib');
    // Short names pass through untouched.
    expect(result.shortLabels.Chat).toBe('Chat');
  });

  it('clips a long single-word label with an ellipsis', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([pair('Administration', 'Chat', 1)]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result.shortLabels.Administration).toBe('Administr…');
  });

  it('returns an empty matrix for a range with no transitions', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getPageTransitions(TimeRange.Week, userGroupId, userId);

    expect(result).toEqual({
      pages: [],
      shortLabels: {},
      matrix: {},
      totalTransitions: 0,
    });
  });

  it('logs and rethrows a sanitized error when the query fails', async () => {
    const error = new Error('Database error');
    (db.$queryRaw as jest.Mock).mockRejectedValue(error);

    await expect(getPageTransitions(TimeRange.Week, userGroupId, userId))
      .rejects.toThrow('Failed to fetch page transition statistics');

    expect(logger.error).toHaveBeenCalledWith('Error fetching page transitions', { error });
  });
});
