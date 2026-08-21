import db from '@/server/db';
import logger from '@/server/logger';
import getActivityStrips from './getActivityStrips';
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

describe('getActivityStrips', () => {
  const userGroupId = 'all';
  const userId = 'all';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cuts one session per (user, session number) run', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u1', 'Ada', 1, 'Library', '2024-01-01T10:05:00Z'),
      nav('u1', 'Ada', 2, 'Chat', '2024-01-01T14:00:00Z'),
      nav('u2', 'Bo', 1, 'Prompts', '2024-01-01T11:00:00Z'),
    ]);

    const result = await getActivityStrips(TimeRange.Week, userGroupId, userId);

    expect(result.totalSessions).toBe(3);
    expect(result.totalEvents).toBe(4);
    expect(result.userCount).toBe(2);
    expect(result.sessions[0]).toMatchObject({
      id: 'u1:1',
      userId: 'u1',
      userName: 'Ada',
      eventCount: 2,
      startedAt: '2024-01-01T10:00:00.000Z',
      endedAt: '2024-01-01T10:05:00.000Z',
    });
  });

  it('spans the axis from the earliest to the latest event', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u2', 'Bo', 1, 'Chat', '2024-01-03T18:30:00Z'),
    ]);

    const result = await getActivityStrips(TimeRange.Week, userGroupId, userId);

    expect(result.rangeStart).toBe('2024-01-01T10:00:00.000Z');
    expect(result.rangeEnd).toBe('2024-01-03T18:30:00.000Z');
  });

  it('builds a session path of labels with consecutive repeats collapsed', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      nav('u1', 'Ada', 1, 'Library', '2024-01-01T10:00:00Z'),
      nav('u1', 'Ada', 1, 'Library', '2024-01-01T10:01:00Z'),
      nav('u1', 'Ada', 1, 'Document', '2024-01-01T10:02:00Z'),
    ]);

    const result = await getActivityStrips(TimeRange.Week, userGroupId, userId);

    expect(result.sessions[0].path).toEqual(['Library', 'Document']);
    // Collapsing labels must not change the event count the block's brightness
    // is scaled by.
    expect(result.sessions[0].eventCount).toBe(3);
  });

  it('folds a path longer than the chip limit into a trailing summary step', async () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      nav('u1', 'Ada', 1, `Page${i}`, `2024-01-01T10:${String(i).padStart(2, '0')}:00Z`));
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce(rows);

    const result = await getActivityStrips(TimeRange.Week, userGroupId, userId);

    expect(result.sessions[0].path).toHaveLength(13);
    expect(result.sessions[0].path[12]).toBe('+3 more');
  });

  it('pins the viewer first and flags them, then orders by session count', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u2', 'Bo', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u2', 'Bo', 2, 'Chat', '2024-01-01T14:00:00Z'),
      nav('u3', 'Cy', 1, 'Chat', '2024-01-01T10:00:00Z'),
      nav('u3', 'Cy', 2, 'Chat', '2024-01-01T14:00:00Z'),
      nav('u3', 'Cy', 3, 'Chat', '2024-01-01T18:00:00Z'),
    ]);

    const result = await getActivityStrips(TimeRange.Week, userGroupId, userId, false, 'u1');

    expect(result.users.map((u) => u.id)).toEqual(['u1', 'u3', 'u2']);
    expect(result.users[0].isSelf).toBe(true);
    expect(result.users[1].isSelf).toBe(false);
  });

  it('labels a session with a missing user name rather than dropping it', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { ...nav('u1', 'Ada', 1, 'Chat', '2024-01-01T10:00:00Z'), userName: null },
    ]);

    const result = await getActivityStrips(TimeRange.Week, userGroupId, userId);

    expect(result.sessions[0].userName).toBe('Unknown user');
    expect(result.users[0].name).toBe('Unknown user');
  });

  it('collapses the range to a single instant when there is no data', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getActivityStrips(TimeRange.Week, userGroupId, userId);

    expect(result.sessions).toEqual([]);
    expect(result.users).toEqual([]);
    expect(result.totalSessions).toBe(0);
    expect(result.totalEvents).toBe(0);
    // A zero-width range is what tells the client to render an empty track
    // instead of dividing by a negative span.
    expect(result.rangeStart).toBe(result.rangeEnd);
  });

  it('logs and rethrows a sanitized error when the query fails', async () => {
    const error = new Error('Database error');
    (db.$queryRaw as jest.Mock).mockRejectedValue(error);

    await expect(getActivityStrips(TimeRange.Week, userGroupId, userId))
      .rejects.toThrow('Failed to fetch activity statistics');

    expect(logger.error).toHaveBeenCalledWith('Error fetching activity strips', { error });
  });
});
