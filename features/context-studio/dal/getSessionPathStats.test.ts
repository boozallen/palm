import db from '@/server/db';
import logger from '@/server/logger';
import getSessionPathStats from './getSessionPathStats';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

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

type Row = {
  userId: string;
  userName: string | null;
  session_no: number;
  event: string;
  description: string | null;
  timestamp: Date;
};

const nav = (
  userId: string,
  userName: string,
  sessionNo: number,
  label: string,
  timestamp: string,
): Row => ({
  userId,
  userName,
  session_no: sessionNo,
  event: AuditRecordEvent.Navigation,
  description: `User clicked "${label} (/${label.toLowerCase()})"`,
  timestamp: new Date(timestamp),
});

// One session per user, all walking the same ordered path — the simplest way to
// build a lane of a known size.
const sessionsOnPath = (steps: string[], count: number, prefix: string): Row[] =>
  Array.from({ length: count }, (_, i) =>
    steps.map((step, s) =>
      nav(
        `${prefix}${i}`,
        `${prefix} user ${i}`,
        1,
        step,
        `2024-01-01T10:${String(s).padStart(2, '0')}:00Z`,
      ))).flat();

describe('getSessionPathStats', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges identical ordered paths into one lane and ranks lanes by count', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      ...sessionsOnPath(['Chat', 'Library'], 1, 'a'),
      ...sessionsOnPath(['Chat', 'Prompts'], 3, 'b'),
    ]);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result.paths).toHaveLength(2);
    expect(result.paths[0]).toMatchObject({
      id: 'p1',
      count: 3,
      steps: ['Chat', 'Prompts'],
    });
    expect(result.paths[1]).toMatchObject({ id: 'p2', count: 1, steps: ['Chat', 'Library'] });
    expect(result.totalSessions).toBe(4);
  });

  it('treats a differently ordered path as a distinct lane', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      ...sessionsOnPath(['Chat', 'Library'], 1, 'a'),
      ...sessionsOnPath(['Library', 'Chat'], 1, 'b'),
    ]);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result.paths).toHaveLength(2);
  });

  it('collapses consecutive repeats so equivalent journeys share a lane', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:01:00Z'),
      nav('u1', 'Ada', 1, 'Library', '2024-01-01T10:02:00Z'),
      nav('u2', 'Bo', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u2', 'Bo', 1, 'Library', '2024-01-01T10:02:00Z'),
    ]);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toMatchObject({ count: 2, steps: ['Chat', 'Library'] });
  });

  it('caps lanes at the top six and buckets the tail into one Other lane', async () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      sessionsOnPath(['Chat', `Page${i}`], 9 - i, `p${i}`)).flat();
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce(rows);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    // Six ranked lanes plus the bucket.
    expect(result.paths).toHaveLength(7);
    const other = result.paths[6];
    expect(other.isOther).toBe(true);
    expect(other.id).toBe('other');
    // Ranks 7, 8, 9 carry 3 + 2 + 1 sessions.
    expect(other.count).toBe(6);
    expect(other.steps).toEqual(['Other paths', '3 distinct paths']);
  });

  it('omits the Other lane when every path fits', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce(sessionsOnPath(['Chat'], 2, 'a'));

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result.paths).toHaveLength(1);
    expect(result.paths.some((p) => p.isOther)).toBe(false);
  });

  it('folds an over-long path into a trailing summary step', async () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      nav('u1', 'Ada', 1, `Page${i}`, `2024-01-01T10:${String(i).padStart(2, '0')}:00Z`));
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce(rows);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result.paths[0].steps).toHaveLength(10);
    expect(result.paths[0].steps[9]).toBe('+3 more');
  });

  it('reports a sample user and a clock window for each lane', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u1', 'Ada', 1, 'Library', '2024-01-01T10:42:00Z'),
    ]);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result.paths[0].sampleUser).toBe('Ada');
    expect(result.paths[0].window).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
  });

  it('counts navigations separately from total events', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:00:00Z'),
      {
        userId: 'u1',
        userName: 'Ada',
        session_no: 1,
        event: AuditRecordEvent.UserSignOut,
        description: null,
        timestamp: new Date('2024-01-01T10:05:00Z'),
      },
    ]);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result.totalEvents).toBe(2);
    expect(result.totalNavigations).toBe(1);
    expect(result.paths[0].steps).toEqual(['Chat', 'User Sign Out']);
  });

  it('returns an empty result set for a range with no events', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getSessionPathStats(TimeRange.Week, userGroupId, userId);

    expect(result).toEqual({
      paths: [],
      totalSessions: 0,
      totalEvents: 0,
      totalNavigations: 0,
    });
  });

  it('logs and rethrows a sanitized error when the query fails', async () => {
    const error = new Error('Database error');
    (db.$queryRaw as jest.Mock).mockRejectedValue(error);

    await expect(getSessionPathStats(TimeRange.Week, userGroupId, userId))
      .rejects.toThrow('Failed to fetch session path statistics');

    expect(logger.error).toHaveBeenCalledWith('Error fetching session path stats', { error });
  });
});
