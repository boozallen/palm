import db from '@/server/db';
import logger from '@/server/logger';
import getChatStats from './getChatStats';
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

type MockFragment = {
  strings: TemplateStringsArray;
  values: unknown[];
};

const isFragment = (value: unknown): value is MockFragment =>
  typeof value === 'object' && value !== null && 'strings' in value;

// Flattens the mocked fragment tree into the SQL text the query would run, so a
// time bound that resolved to `undefined` is visible instead of silently passing.
const render = (value: unknown): string => {
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  if (typeof value === 'symbol') { return ''; }
  return String(value);
};

// `db.$queryRaw` is invoked as a tagged template, so the call is
// [stringsArray, ...interpolatedValues] rather than a single fragment.
const capturedSql = (): string => {
  const [strings, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0];

  return (strings as TemplateStringsArray)
    .map((chunk, i) => chunk + (i < values.length ? render(values[i]) : ''))
    .join('');
};

const STATS_ROW = [{
  total: BigInt(1),
  withPrompt: BigInt(1),
  withAgent: BigInt(1),
  withUploadedSources: BigInt(1),
  withKnowledgeBaseSources: BigInt(1),
}];

describe('getChatStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TimeRange lower bounds', () => {
    it.each([
      [TimeRange.Day, 'c."createdAt" >= NOW() - INTERVAL \'24 hours\''],
      [TimeRange.Week, 'c."createdAt" >= NOW() - INTERVAL \'7 days\''],
      [TimeRange.Month, 'c."createdAt" >= NOW() - INTERVAL \'30 days\''],
      [TimeRange.Year, 'c."createdAt" >= NOW() - INTERVAL \'365 days\''],
      [TimeRange.YearToDate, 'c."createdAt" >= date_trunc(\'year\', NOW())'],
    ])('applies the expected bound for %s', async (timeRange, expected) => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce(STATS_ROW);

      await getChatStats(timeRange, userGroupId, userId);

      expect(capturedSql()).toContain(expected);
    });

    it('applies no time bound for the forever range', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce(STATS_ROW);

      await getChatStats(TimeRange.Forever, userGroupId, userId);

      expect(capturedSql()).not.toContain('INTERVAL');
    });
  });

  describe('Basic stats retrieval', () => {
    it('should fetch chat stats successfully', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          total: BigInt(100),
          withPrompt: BigInt(50),
          withAgent: BigInt(30),
          withUploadedSources: BigInt(20),
          withKnowledgeBaseSources: BigInt(15),
        },
      ]);

      const result = await getChatStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(100);
      expect(result.withPrompt).toBe(50);
      expect(result.withAgent).toBe(30);
      expect(result.withUploadedSources).toBe(20);
      expect(result.withKnowledgeBaseSources).toBe(15);
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          total: BigInt(25),
          withPrompt: BigInt(10),
          withAgent: BigInt(5),
          withUploadedSources: BigInt(3),
          withKnowledgeBaseSources: BigInt(2),
        },
      ]);

      const result = await getChatStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(25);
    });

    it('should fetch stats for forever time range', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          total: BigInt(1000),
          withPrompt: BigInt(500),
          withAgent: BigInt(300),
          withUploadedSources: BigInt(200),
          withKnowledgeBaseSources: BigInt(150),
        },
      ]);

      const result = await getChatStats(TimeRange.Forever, userGroupId, userId);

      expect(result.total).toBe(1000);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          total: BigInt(10),
          withPrompt: BigInt(5),
          withAgent: BigInt(2),
          withUploadedSources: BigInt(1),
          withKnowledgeBaseSources: BigInt(1),
        },
      ]);

      const result = await getChatStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.total).toBe(10);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          total: BigInt(50),
          withPrompt: BigInt(25),
          withAgent: BigInt(15),
          withUploadedSources: BigInt(10),
          withKnowledgeBaseSources: BigInt(8),
        },
      ]);

      const result = await getChatStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.total).toBe(50);
    });

    // A Lead scoped to one group can only ever see members of that group, even
    // when they also pass a specific userId, so the userId and group predicates
    // must both apply rather than the userId replacing the group check.
    it('constrains a specific userId to also be a member of the requested group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock).mockResolvedValueOnce(STATS_ROW);

      await getChatStats(TimeRange.Month, specificUserGroupId, specificUserId);

      const sql = capturedSql();
      expect(sql).toContain(`c."userId" = CAST(${specificUserId} AS UUID)`);
      expect(sql).toContain('UserGroupMembership');
      expect(sql).toContain(specificUserGroupId);
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getChatStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch chat statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching chat stats', { error });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero chats', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          total: BigInt(0),
          withPrompt: BigInt(0),
          withAgent: BigInt(0),
          withUploadedSources: BigInt(0),
          withKnowledgeBaseSources: BigInt(0),
        },
      ]);

      const result = await getChatStats(TimeRange.Week, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.withPrompt).toBe(0);
      expect(result.withAgent).toBe(0);
    });

    it('should handle null values', async () => {
      (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      const result = await getChatStats(TimeRange.Month, userGroupId, userId);

      expect(result.total).toBe(0);
      expect(result.withPrompt).toBe(0);
      expect(result.withAgent).toBe(0);
    });
  });
});
