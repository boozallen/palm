import { Prisma } from '@prisma/client';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import { sessionizedRecords } from './sessionizedRecords';

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

// Flattens the mocked fragment tree into the SQL text a view would actually run.
const render = (value: unknown): string => {
  if (value === Prisma.empty) { return ''; }
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  return String(value);
};

const filters = () => Prisma.sql`AND ar."userId" = CAST('u1' AS UUID)`;

describe('sessionizedRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens a WITH chain ending in the sessionized CTE so callers append a SELECT', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql.trim().startsWith('WITH scoped AS (')).toBe(true);
    expect(sql).toContain('gapped AS (');
    expect(sql).toContain('sessionized AS (');
    // No trailing SELECT — the caller supplies it.
    expect(sql.trim().endsWith(')')).toBe(true);
  });

  it('selects the columns every behavior view reads', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    for (const column of [
      'ar.id',
      'ar."userId"',
      'u.name AS "userName"',
      'ar.event',
      'ar.outcome',
      'ar.description',
      'ar.referer',
      'ar."timestamp"',
    ]) {
      expect(sql).toContain(column);
    }
  });

  it('joins the user table without dropping records for a deleted user', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql).toContain('LEFT JOIN "User" u ON u.id = ar."userId"');
  });

  it('drops records with no user so sessions always belong to someone', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql).toContain('WHERE ar."userId" IS NOT NULL');
  });

  it('splices the caller filters into the scoped query', () => {
    const sql = render(sessionizedRecords(filters()));

    expect(sql).toContain('AND ar."userId" = CAST(\'u1\' AS UUID)');
    // Inside `scoped`, after its WHERE — not in a later CTE.
    expect(sql.indexOf('AND ar."userId" = CAST')).toBeGreaterThan(sql.indexOf('WHERE ar."userId" IS NOT NULL'));
    expect(sql.indexOf('AND ar."userId" = CAST')).toBeLessThan(sql.indexOf('gapped AS ('));
  });

  it('omits filters entirely when none are supplied', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql).not.toContain('AND ar.');
  });

  it('cuts a new session on a 30-minute inactivity gap', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql).toContain('interval \'30 minutes\'');
    expect(sql).toContain('"timestamp" - LAG("timestamp") OVER user_time');
  });

  it('cuts a new session at a sign-in, so a sign-in always opens one', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql).toContain(`event = ${AuditRecordEvent.UserSignIn}`);
  });

  it('cuts a new session after a sign-out, so a sign-out always closes one', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    // LAG, not the current row: the boundary falls on the record *after* the
    // sign-out, keeping the sign-out itself inside the session it ended.
    expect(sql).toContain(`LAG(event) OVER user_time = ${AuditRecordEvent.UserSignOut}`);
  });

  it('starts a session at a user\'s first record, which has no predecessor', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql).toContain('IS NULL');
    expect(sql).toContain('THEN 1 ELSE 0 END AS is_session_start');
  });

  it('numbers sessions per user by a running sum of session starts', () => {
    const sql = render(sessionizedRecords(Prisma.empty));

    expect(sql).toContain('SUM(is_session_start) OVER (');
    expect(sql).toContain('ROWS UNBOUNDED PRECEDING');
    expect(sql).toContain('AS session_no');
  });

  it('partitions and orders every window by user and timestamp', () => {
    const sql = render(sessionizedRecords(Prisma.empty));
    const windows = sql.match(/PARTITION BY "userId" ORDER BY "timestamp"/g) ?? [];

    // One named WINDOW shared by every LAG in `gapped`, and the SUM window in
    // `sessionized`. Naming the window is what keeps the four boundary rules
    // provably reading the same ordering.
    expect(windows).toHaveLength(2);
    expect(sql).toContain('WINDOW user_time AS (PARTITION BY "userId" ORDER BY "timestamp")');
  });

  it('builds the session gap fresh on each call rather than sharing a fragment', () => {
    const first = sessionizedRecords(Prisma.empty);
    const second = sessionizedRecords(Prisma.empty);

    expect(first).not.toBe(second);
    expect(render(first)).toEqual(render(second));
  });
});
