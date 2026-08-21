import { Prisma } from '@prisma/client';
import { buildAuditFilters } from './auditFilters';
import { TimeRange } from '@/features/context-studio/types/context-studio';

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
// A skipped filter is `Prisma.empty`, which contributes nothing — the same way it
// behaves in a real composed query.
const render = (value: unknown): string => {
  if (value === Prisma.empty) { return ''; }
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  return String(value);
};

const USER_ID = '11111111-1111-1111-1111-111111111111';
const GROUP_ID = '22222222-2222-2222-2222-222222222222';

describe('buildAuditFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [TimeRange.Day, '24 hours'],
    [TimeRange.Week, '7 days'],
    [TimeRange.Month, '30 days'],
    [TimeRange.Year, '365 days'],
  ])('bounds %s to the last %s', (timeRange, interval) => {
    const sql = render(buildAuditFilters(timeRange, 'all', 'all', false));

    expect(sql).toContain(`AND ar."timestamp" >= NOW() - INTERVAL '${interval}'`);
  });

  it('bounds the year to date range at the start of the calendar year', () => {
    const sql = render(buildAuditFilters(TimeRange.YearToDate, 'all', 'all', false));

    expect(sql).toContain('AND ar."timestamp" >= date_trunc(\'year\', NOW())');
  });

  it('applies no time bound for the forever range', () => {
    const sql = render(buildAuditFilters(TimeRange.Forever, 'all', 'all', false));

    expect(sql).not.toContain('timestamp');
    expect(sql.trim()).toBe('');
  });

  it('omits the user and group predicates when both are "all"', () => {
    const sql = render(buildAuditFilters(TimeRange.Week, 'all', 'all', false));

    expect(sql).not.toContain('ar."userId"');
  });

  it('restricts to a single user when a user id is given', () => {
    const sql = render(buildAuditFilters(TimeRange.Week, 'all', USER_ID, false));

    expect(sql).toContain(`AND ar."userId" = CAST(${USER_ID} AS UUID)`);
  });

  it('restricts to a group via its membership table when a group id is given', () => {
    const sql = render(buildAuditFilters(TimeRange.Week, GROUP_ID, 'all', false));

    expect(sql).toContain('AND ar."userId" IN (');
    expect(sql).toContain('SELECT "userId" FROM "UserGroupMembership"');
    expect(sql).toContain(`"userGroupId" = CAST(${GROUP_ID} AS UUID)`);
  });

  it('excludes admin users only when asked to', () => {
    const excluded = render(buildAuditFilters(TimeRange.Week, 'all', 'all', true));
    const included = render(buildAuditFilters(TimeRange.Week, 'all', 'all', false));

    expect(excluded).toContain(
      'AND ar."userId" NOT IN (SELECT id FROM "User" WHERE role = \'Admin\')',
    );
    expect(included).not.toContain('Admin');
  });

  it('combines every filter into one conjunction', () => {
    const sql = render(buildAuditFilters(TimeRange.Month, GROUP_ID, USER_ID, true));

    expect(sql).toContain('INTERVAL \'30 days\'');
    expect(sql).toContain(`ar."userId" = CAST(${USER_ID} AS UUID)`);
    expect(sql).toContain('"UserGroupMembership"');
    expect(sql).toContain('WHERE role = \'Admin\'');
  });

  it('parameterizes the ids instead of interpolating them into the SQL text', () => {
    buildAuditFilters(TimeRange.Week, GROUP_ID, USER_ID, true);

    // Only the fixed column reference and time-range interval are injected as raw
    // SQL; the caller's ids travel as bind values.
    expect(Prisma.raw).toHaveBeenCalledWith('ar."timestamp"');
    expect(Prisma.raw).toHaveBeenCalledWith('7 days');
    expect(Prisma.raw).not.toHaveBeenCalledWith(USER_ID);
    expect(Prisma.raw).not.toHaveBeenCalledWith(GROUP_ID);
  });

  it('aliases every predicate to `ar` so it composes inside the sessionized CTE', () => {
    const sql = render(buildAuditFilters(TimeRange.Week, GROUP_ID, USER_ID, true));
    const columnRefs = sql.match(/\b\w+\."(timestamp|userId)"/g) ?? [];

    expect(columnRefs.length).toBeGreaterThan(0);
    expect(columnRefs.every((ref) => ref.startsWith('ar.'))).toBe(true);
  });

  it('starts every predicate with AND so it appends to an existing WHERE clause', () => {
    const sql = render(buildAuditFilters(TimeRange.Week, GROUP_ID, USER_ID, true)).trim();

    expect(sql.startsWith('AND ')).toBe(true);
    expect(sql).not.toMatch(/\bWHERE ar\./);
  });
});
