import db from '@/server/db';
import getTimeInTool from './getTimeInTool';
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

describe('getTimeInTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('converts total seconds into hours rounded to one decimal', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ total_seconds: 9000 }]);

    const result = await getTimeInTool(TimeRange.Month, 'all', 'all', false);

    expect(result).toBe(2.5);
  });

  it('returns zero when no visits are recorded', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getTimeInTool(TimeRange.Month, 'all', 'all', false);

    expect(result).toBe(0);
  });

  it('returns zero rather than NaN when the sum is null', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ total_seconds: null }]);

    const result = await getTimeInTool(TimeRange.Month, 'all', 'all', false);

    expect(result).toBe(0);
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('deadlock detected'));

    await expect(
      getTimeInTool(TimeRange.Month, 'all', 'all', false),
    ).rejects.toThrow('Failed to fetch measured time in tool');
  });
});
