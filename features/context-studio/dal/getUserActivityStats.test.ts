import db from '@/server/db';
import logger from '@/server/logger';
import getUserActivityStats from './getUserActivityStats';
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

const render = (value: unknown): string => {
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  if (typeof value === 'symbol') { return ''; }

  return String(value);
};

// This DAL fires sixteen queries in one Promise.all, so a bound is asserted
// against the whole batch rather than a single positional call. `db.$queryRaw` is
// a tagged template: each call is [stringsArray, ...values].
const allRenderedSql = (): string =>
  (db.$queryRaw as jest.Mock).mock.calls
    .map(([strings, ...values]: [TemplateStringsArray, ...unknown[]]) => strings
      .map((chunk, i) => chunk + (i < values.length ? render(values[i]) : ''))
      .join(''))
    .join('\n');

describe('getUserActivityStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('New time range presets', () => {
    beforeEach(() => {
      (db.$queryRaw as jest.Mock).mockResolvedValue([]);
    });

    it('bounds the day range to the last 24 hours', async () => {
      await getUserActivityStats(TimeRange.Day, userGroupId, userId);

      expect(allRenderedSql()).toContain('NOW() - INTERVAL \'24 hours\'');
    });

    it('buckets the day range by day, matching the shorter rolling ranges', async () => {
      await getUserActivityStats(TimeRange.Day, userGroupId, userId);

      const sql = allRenderedSql();

      expect(sql).toContain('DATE_TRUNC(\'day\'');
      expect(sql).toContain('\'1 day\'::interval');
    });

    it('anchors the year to date series at the start of the calendar year', async () => {
      await getUserActivityStats(TimeRange.YearToDate, userGroupId, userId);

      expect(allRenderedSql()).toContain('date_trunc(\'year\', NOW())');
    });

    it('buckets the year to date range by week, matching the year range', async () => {
      await getUserActivityStats(TimeRange.YearToDate, userGroupId, userId);

      const sql = allRenderedSql();

      expect(sql).toContain('DATE_TRUNC(\'week\'');
      expect(sql).toContain('\'1 week\'::interval');
    });

    it('compares year to date against the same calendar span one year earlier', async () => {
      await getUserActivityStats(TimeRange.YearToDate, userGroupId, userId);

      expect(allRenderedSql())
        .toContain('date_trunc(\'year\', NOW()) - INTERVAL \'1 year\'');
    });

    it.each([TimeRange.Day, TimeRange.YearToDate])(
      'never emits an undefined interval for the %s range',
      async (timeRange) => {
        await getUserActivityStats(timeRange, userGroupId, userId);

        expect(allRenderedSql()).not.toContain('undefined');
      },
    );
  });

  describe('Basic stats retrieval', () => {
    it('should fetch user activity stats successfully', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(100) }]) // total users
        .mockResolvedValueOnce([{ count: BigInt(5) }]) // user groups
        .mockResolvedValueOnce([{ count: BigInt(50) }]) // logins
        .mockResolvedValueOnce([{ count: BigInt(75) }]) // sessions
        .mockResolvedValueOnce([{ count: BigInt(10) }]) // new users current
        .mockResolvedValueOnce([{ count: BigInt(8) }]) // new users previous
        .mockResolvedValueOnce([{ count: BigInt(2) }]) // join code uses
        .mockResolvedValueOnce([{ count: BigInt(60) }]) // audit logins
        .mockResolvedValueOnce([{ count: BigInt(40) }]) // audit unique users
        .mockResolvedValueOnce([{ count: BigInt(5) }]) // audit logins blocked
        .mockResolvedValueOnce([ // time series
          {
            date: new Date('2024-01-01'),
            logins: BigInt(10),
            sessions: BigInt(15),
            newUsers: BigInt(2),
          },
        ])
        .mockResolvedValueOnce([ // audit login time series
          { date: new Date('2024-01-01'), loginCount: BigInt(12) },
        ])
        .mockResolvedValueOnce([ // audit login blocked time series
          { date: new Date('2024-01-01'), loginCount: BigInt(1) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(10) }]) // user created count
        .mockResolvedValueOnce([{ earliest: new Date('2023-01-01') }]) // earliest user created
        .mockResolvedValueOnce([ // user created time series
          { date: new Date('2024-01-01'), count: BigInt(2) },
        ]);

      const result = await getUserActivityStats(TimeRange.Month, userGroupId, userId);

      expect(result.totalUsers).toBe(100);
      expect(result.userGroups).toBe(5);
      expect(result.logins).toBe(50);
      expect(result.totalSessions).toBe(75);
      expect(result.newUsersThisWeek).toBe(10);
      expect(result.newUsersPreviousWeek).toBe(8);
      expect(result.joinCodeUses).toBe(2);
      expect(result.auditLogins).toBe(60);
      expect(result.auditLoginsBlocked).toBe(5);
      expect(result.userCreatedCount).toBe(10);
      expect(result.earliestUserCreatedDate).toBe('2023-01-01');
      expect(result.userActivityTimeSeries).toEqual([
        {
          date: '2024-01-01',
          logins: 10,
          sessions: 15,
          newUsers: 2,
        },
      ]);
      expect(result.auditLoginTimeSeries).toEqual([
        { date: '2024-01-01', loginCount: 12 },
      ]);
      expect(result.auditLoginBlockedTimeSeries).toEqual([
        { date: '2024-01-01', loginCount: 1 },
      ]);
      expect(result.userCreatedTimeSeries).toEqual([
        { date: '2024-01-01', count: 2 },
      ]);
    });
  });

  describe('TimeRange filtering', () => {
    it('should fetch stats for week time range', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(25) }])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ earliest: new Date('2023-01-01') }])
        .mockResolvedValueOnce([]);

      const result = await getUserActivityStats(TimeRange.Week, userGroupId, userId);

      expect(result.totalUsers).toBe(50);
      expect(result.logins).toBe(20);
    });

    it('should fetch stats for forever time range with no previous period', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(500) }])
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(300) }])
        .mockResolvedValueOnce([{ count: BigInt(400) }])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(350) }])
        .mockResolvedValueOnce([{ count: BigInt(200) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(50) }])
        .mockResolvedValueOnce([{ earliest: new Date('2020-01-01') }])
        .mockResolvedValueOnce([]);

      const result = await getUserActivityStats(TimeRange.Forever, userGroupId, userId);

      expect(result.totalUsers).toBe(500);
      expect(result.newUsersPreviousWeek).toBe(0);
    });
  });

  describe('User filtering', () => {
    it('should filter by specific user', async () => {
      const specificUserId = '123e4567-e89b-12d3-a456-426614174000';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ earliest: new Date('2023-01-01') }])
        .mockResolvedValueOnce([]);

      const result = await getUserActivityStats(TimeRange.Month, userGroupId, specificUserId);

      expect(result.totalUsers).toBe(1);
    });

    it('should filter by user group', async () => {
      const specificUserGroupId = '123e4567-e89b-12d3-a456-426614174001';

      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(25) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(3) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(18) }])
        .mockResolvedValueOnce([{ count: BigInt(12) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ earliest: new Date('2023-01-01') }])
        .mockResolvedValueOnce([]);

      const result = await getUserActivityStats(TimeRange.Year, specificUserGroupId, 'all');

      expect(result.totalUsers).toBe(25);
    });
  });

  describe('Login source', () => {
    it('should count logins and sessions from sign-in audit records, not Account rows', async () => {
      // Empty rows for every query — this test only inspects the SQL sources.
      (db.$queryRaw as jest.Mock).mockResolvedValue([]);

      await getUserActivityStats(TimeRange.Week, userGroupId, userId);

      // Calls 3 and 4 are the logins and sessions counts. `Account.updatedAt` is
      // an OAuth token timestamp, not a login, so it must not be the source.
      const [loginsCall, sessionsCall] = (db.$queryRaw as jest.Mock).mock.calls
        .slice(2, 4)
        .map((call) => (call[0] as TemplateStringsArray).join(' '));

      for (const sql of [loginsCall, sessionsCall]) {
        expect(sql).toContain('"AuditRecord"');
        expect(sql).toContain('USER_SIGN_IN');
        expect(sql).not.toContain('"Account"');
      }
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when database query fails', async () => {
      const error = new Error('Database error');
      (db.$queryRaw as jest.Mock).mockRejectedValue(error);

      await expect(getUserActivityStats(TimeRange.Week, userGroupId, userId))
        .rejects.toThrow('Failed to fetch user activity statistics');

      expect(logger.error).toHaveBeenCalledWith('Error fetching user activity stats', { error });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero user activity', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ earliest: null }])
        .mockResolvedValueOnce([]);

      const result = await getUserActivityStats(TimeRange.Week, userGroupId, userId);

      expect(result.totalUsers).toBe(0);
      expect(result.logins).toBe(0);
      expect(result.earliestUserCreatedDate).toBeNull();
    });

    it('should handle null count values', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getUserActivityStats(TimeRange.Month, userGroupId, userId);

      expect(result.totalUsers).toBe(0);
      expect(result.userGroups).toBe(0);
      expect(result.logins).toBe(0);
    });

    it('should handle empty time series data', async () => {
      (db.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([{ count: BigInt(8) }])
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([{ count: BigInt(6) }])
        .mockResolvedValueOnce([{ count: BigInt(4) }])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([]) // empty time series
        .mockResolvedValueOnce([]) // empty audit login time series
        .mockResolvedValueOnce([]) // empty audit login blocked time series
        .mockResolvedValueOnce([{ count: BigInt(2) }])
        .mockResolvedValueOnce([{ earliest: new Date('2023-01-01') }])
        .mockResolvedValueOnce([]); // empty user created time series

      const result = await getUserActivityStats(TimeRange.Week, userGroupId, userId);

      expect(result.userActivityTimeSeries).toEqual([]);
      expect(result.auditLoginTimeSeries).toEqual([]);
      expect(result.auditLoginBlockedTimeSeries).toEqual([]);
      expect(result.userCreatedTimeSeries).toEqual([]);
    });
  });
});
