import db from '@/server/db';
import logger from '@/server/logger';
import getUserActivity from './getUserActivity';
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

type RawRow = {
  kind: 'event' | 'run';
  id: string;
  event: string | null;
  outcome: string | null;
  description: string | null;
  started_at: Date;
  ended_at: Date;
  n: number;
  hrefs: string[] | null;
};

const eventRow = (overrides: Partial<RawRow> = {}): RawRow => ({
  kind: 'event',
  id: 'event-1',
  event: 'USER_SIGN_IN',
  outcome: 'SUCCESS',
  description: 'Signed in',
  started_at: new Date('2026-07-21T09:00:00.000Z'),
  ended_at: new Date('2026-07-21T09:00:00.000Z'),
  n: 1,
  hrefs: [],
  ...overrides,
});

const runRow = (overrides: Partial<RawRow> = {}): RawRow => ({
  kind: 'run',
  id: 'audit-42',
  event: null,
  outcome: null,
  description: null,
  started_at: new Date('2026-07-21T09:01:00.000Z'),
  ended_at: new Date('2026-07-21T09:06:00.000Z'),
  n: 14,
  hrefs: ['/chat', '/library'],
  ...overrides,
});

const counts = (total: number, meaningful: number, errors: number) => [{ total, meaningful, errors }];

// The DAL fires three queries in order: collapsed rows, counts, then the name.
const mockQueries = (rows: RawRow[], countRows = counts(0, 0, 0), name: string | null = 'Ada Lovelace') => {
  (db.$queryRaw as jest.Mock)
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce(countRows)
    .mockResolvedValueOnce([{ name }]);
};

describe('getUserActivity', () => {
  const userGroupId = 'all';
  const userId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty trail without querying when no user is selected', async () => {
    const result = await getUserActivity(TimeRange.Week, userGroupId, 'all');

    expect(result).toEqual({
      userId: 'all',
      userName: null,
      totalRecords: 0,
      meaningfulRecords: 0,
      errorRecords: 0,
      entries: [],
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('maps a discrete event row to a labelled entry', async () => {
    mockQueries([eventRow()], counts(1, 1, 0));

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries).toEqual([{
      kind: 'event',
      id: 'event-1',
      event: 'USER_SIGN_IN',
      label: 'User Sign In',
      description: 'Signed in',
      outcome: 'SUCCESS',
      timestamp: '2026-07-21T09:00:00.000Z',
      idleBeforeMs: 0,
    }]);
  });

  it('maps a collapsed run row to a run entry with a prefixed id', async () => {
    mockQueries([runRow()], counts(14, 0, 0));

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries).toEqual([{
      kind: 'run',
      id: 'run-audit-42',
      count: 14,
      hrefs: ['/chat', '/library'],
      startedAt: '2026-07-21T09:01:00.000Z',
      endedAt: '2026-07-21T09:06:00.000Z',
    }]);
  });

  it('falls back to an empty href list when the run aggregate is null', async () => {
    mockQueries([runRow({ hrefs: null })]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries[0]).toMatchObject({ kind: 'run', hrefs: [] });
  });

  it('falls back to the raw event name for an event with no label mapping', async () => {
    mockQueries([eventRow({ event: 'SOME_FUTURE_EVENT' })]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries[0]).toMatchObject({ event: 'SOME_FUTURE_EVENT', label: 'SOME_FUTURE_EVENT' });
  });

  it('labels an event with a null event name as generic activity', async () => {
    mockQueries([eventRow({ event: null })]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries[0]).toMatchObject({ event: '', label: 'Activity' });
  });

  it('coerces a null description and outcome to empty strings', async () => {
    mockQueries([eventRow({ description: null, outcome: null })]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries[0]).toMatchObject({ description: '', outcome: '' });
  });

  it('leaves the first entry with no idle time', async () => {
    mockQueries([
      eventRow({ id: 'a', started_at: new Date('2026-07-21T09:00:00.000Z'), ended_at: new Date('2026-07-21T09:00:00.000Z') }),
      eventRow({ id: 'b', started_at: new Date('2026-07-21T09:00:30.000Z'), ended_at: new Date('2026-07-21T09:00:30.000Z') }),
    ]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries[0]).toMatchObject({ idleBeforeMs: 0 });
    expect(result.entries[1]).toMatchObject({ idleBeforeMs: 30_000 });
  });

  it('measures idle time from the end of a preceding run, not its start', async () => {
    mockQueries([
      // A five-minute run, then an event two minutes after the run's last click.
      runRow({ started_at: new Date('2026-07-21T09:00:00.000Z'), ended_at: new Date('2026-07-21T09:05:00.000Z') }),
      eventRow({ id: 'after-run', started_at: new Date('2026-07-21T09:07:00.000Z'), ended_at: new Date('2026-07-21T09:07:00.000Z') }),
    ]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries[1]).toMatchObject({ id: 'after-run', idleBeforeMs: 120_000 });
  });

  it('clamps idle time to zero when two records share a timestamp', async () => {
    const at = new Date('2026-07-21T09:00:00.000Z');
    mockQueries([
      eventRow({ id: 'a', started_at: at, ended_at: new Date('2026-07-21T09:00:05.000Z') }),
      // Starts before the previous row ended, which would otherwise go negative.
      eventRow({ id: 'b', started_at: at, ended_at: at }),
    ]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.entries[1]).toMatchObject({ idleBeforeMs: 0 });
  });

  it('returns the record counts and the resolved user name', async () => {
    mockQueries([eventRow()], counts(120, 34, 2), 'Grace Hopper');

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result).toMatchObject({
      userId,
      userName: 'Grace Hopper',
      totalRecords: 120,
      meaningfulRecords: 34,
      errorRecords: 2,
    });
  });

  it('returns a null user name when the user row is missing', async () => {
    (db.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(counts(0, 0, 0))
      .mockResolvedValueOnce([]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result.userName).toBeNull();
  });

  it('zeroes the counts when the count query returns no row', async () => {
    (db.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'Ada Lovelace' }]);

    const result = await getUserActivity(TimeRange.Week, userGroupId, userId);

    expect(result).toEqual({
      userId,
      userName: 'Ada Lovelace',
      totalRecords: 0,
      meaningfulRecords: 0,
      errorRecords: 0,
      entries: [],
    });
  });

  it('queries with the same filters for every time range', async () => {
    for (const timeRange of [TimeRange.Week, TimeRange.Month, TimeRange.Year, TimeRange.Forever]) {
      (db.$queryRaw as jest.Mock).mockReset();
      mockQueries([eventRow()], counts(1, 1, 0));

      const result = await getUserActivity(timeRange, userGroupId, userId);

      expect(db.$queryRaw).toHaveBeenCalledTimes(3);
      expect(result.entries).toHaveLength(1);
    }
  });

  // Postgres has no min(uuid), so aggregating the raw id column makes every
  // time range fail with 42883 and the trail renders empty.
  it('casts the audit id to text before aggregating it', async () => {
    mockQueries([runRow()], counts(14, 0, 0));

    await getUserActivity(TimeRange.Week, userGroupId, userId);

    const sql = ((db.$queryRaw as jest.Mock).mock.calls[0][0] as TemplateStringsArray).join(' ');

    expect(sql).toContain('MIN(id::text)');
    expect(sql).not.toMatch(/MIN\(id\)/);
  });

  it('logs and rethrows a sanitized error when a query fails', async () => {
    const error = new Error('Database error');
    (db.$queryRaw as jest.Mock).mockRejectedValue(error);

    await expect(getUserActivity(TimeRange.Week, userGroupId, userId))
      .rejects.toThrow('Failed to fetch user activity');

    expect(logger.error).toHaveBeenCalledWith('Error fetching user activity', { error });
  });
});
