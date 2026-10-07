import { Prisma } from '@prisma/client';
import {
  buildPreviousPeriodFilter,
  buildSinceWindowFilter,
  buildTimeRangeFilter,
  buildTimeRangeStart,
  buildWindowFilter,
  resolveTimeRangeStart,
  timeRangeSqlInterval,
} from './timeRangeFilter';
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

// Flattens the mocked fragment tree into the SQL text a query would actually run.
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

// A fixed instant so the rolling windows have exact expected values. Chosen
// mid-year and mid-day so a year-to-date bound is unambiguously distinct from
// every rolling bound.
const NOW = new Date('2026-08-18T12:00:00.000Z');

describe('buildTimeRangeFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [TimeRange.Day, '24 hours'],
    [TimeRange.Week, '7 days'],
    [TimeRange.Month, '30 days'],
    [TimeRange.Year, '365 days'],
  ])('bounds %s to the last %s', (timeRange, interval) => {
    const sql = render(buildTimeRangeFilter(timeRange, 'c."createdAt"'));

    expect(sql).toContain(`AND c."createdAt" >= NOW() - INTERVAL '${interval}'`);
  });

  it('bounds the year to date range at the start of the calendar year', () => {
    const sql = render(buildTimeRangeFilter(TimeRange.YearToDate, 'c."createdAt"'));

    expect(sql).toContain('AND c."createdAt" >= date_trunc(\'year\', NOW())');
  });

  it('applies no time bound for the forever range', () => {
    const sql = render(buildTimeRangeFilter(TimeRange.Forever, 'c."createdAt"'));

    expect(sql.trim()).toBe('');
  });

  it('starts the predicate with AND so it appends to an existing WHERE clause', () => {
    const sql = render(buildTimeRangeFilter(TimeRange.Week, 'c."createdAt"')).trim();

    expect(sql.startsWith('AND ')).toBe(true);
    expect(sql).not.toMatch(/\bWHERE\b/);
  });

  it('injects the field reference as raw SQL rather than a bind value', () => {
    buildTimeRangeFilter(TimeRange.Week, 'c."createdAt"');

    expect(Prisma.raw).toHaveBeenCalledWith('c."createdAt"');
  });
});

describe('resolveTimeRangeStart', () => {
  it.each([
    [TimeRange.Day, '2026-08-17T12:00:00.000Z'],
    [TimeRange.Week, '2026-08-11T12:00:00.000Z'],
    [TimeRange.Month, '2026-07-19T12:00:00.000Z'],
    [TimeRange.Year, '2025-08-18T12:00:00.000Z'],
    [TimeRange.YearToDate, '2026-01-01T00:00:00.000Z'],
  ])('resolves %s to %s', (timeRange, expected) => {
    expect(resolveTimeRangeStart(timeRange, NOW)?.toISOString()).toBe(expected);
  });

  it('has no lower bound for the forever range', () => {
    expect(resolveTimeRangeStart(TimeRange.Forever, NOW)).toBeNull();
  });

  it('never returns an invalid date for any preset', () => {
    Object.values(TimeRange).forEach((timeRange) => {
      const start = resolveTimeRangeStart(timeRange, NOW);

      if (start !== null) {
        expect(Number.isNaN(start.getTime())).toBe(false);
      }
    });
  });
});

describe('buildTimeRangeStart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [TimeRange.Day, '24 hours'],
    [TimeRange.Week, '7 days'],
    [TimeRange.Month, '30 days'],
    [TimeRange.Year, '365 days'],
  ])('expresses the %s lower bound as an offset from NOW()', (timeRange, interval) => {
    expect(render(buildTimeRangeStart(timeRange))).toBe(`NOW() - INTERVAL '${interval}'`);
  });

  it('anchors the year to date lower bound at the calendar year start', () => {
    expect(render(buildTimeRangeStart(TimeRange.YearToDate)))
      .toBe('date_trunc(\'year\', NOW())');
  });

  // Callers substitute their own MIN(...) fallback, so this has to be
  // distinguishable from a bound rather than an empty fragment.
  it('has no lower bound expression for the forever range', () => {
    expect(buildTimeRangeStart(TimeRange.Forever)).toBeNull();
  });

  it('is a bare expression, not a predicate', () => {
    const sql = render(buildTimeRangeStart(TimeRange.Week));

    expect(sql).not.toContain('AND');
    expect(sql).not.toContain('>=');
  });
});

describe('buildPreviousPeriodFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [TimeRange.Day, '24 hours'],
    [TimeRange.Week, '7 days'],
    [TimeRange.Month, '30 days'],
    [TimeRange.Year, '365 days'],
  ])('offsets the %s window back by one full span', (timeRange, interval) => {
    const sql = render(buildPreviousPeriodFilter(timeRange, 'u."createdAt"'));

    expect(sql).toContain(
      `u."createdAt" >= NOW() - INTERVAL '${interval}' - INTERVAL '${interval}'`,
    );
    expect(sql).toContain(`u."createdAt" < NOW() - INTERVAL '${interval}'`);
  });

  // A calendar-anchored window has no fixed span to double, so the comparison is
  // the same calendar span one year back. Deliberate product semantics.
  it('compares year to date against the same calendar span one year earlier', () => {
    const sql = render(buildPreviousPeriodFilter(TimeRange.YearToDate, 'u."createdAt"'));

    expect(sql).toContain('u."createdAt" >= date_trunc(\'year\', NOW()) - INTERVAL \'1 year\'');
    expect(sql).toContain('u."createdAt" < NOW() - INTERVAL \'1 year\'');
  });

  it('has no preceding window for the forever range', () => {
    expect(buildPreviousPeriodFilter(TimeRange.Forever, 'u."createdAt"')).toBeNull();
  });

  it('bounds the window on both sides so it cannot overlap the current period', () => {
    const sql = render(buildPreviousPeriodFilter(TimeRange.Month, 'u."createdAt"'));

    expect(sql).toContain('>=');
    expect(sql).toContain('<');
    expect(sql).toContain('AND');
  });

  it('injects the field reference as raw SQL rather than a bind value', () => {
    buildPreviousPeriodFilter(TimeRange.Week, 'u."createdAt"');

    expect(Prisma.raw).toHaveBeenCalledWith('u."createdAt"');
  });
});

describe('timeRangeSqlInterval', () => {
  it.each([
    [TimeRange.Day, '24 hours'],
    [TimeRange.Week, '7 days'],
    [TimeRange.Month, '30 days'],
    [TimeRange.Year, '365 days'],
  ])('returns the rolling interval literal for %s', (timeRange, expected) => {
    expect(timeRangeSqlInterval(timeRange)).toBe(expected);
  });

  it.each([TimeRange.YearToDate, TimeRange.Forever])(
    'returns null for the non-rolling %s range',
    (timeRange) => {
      expect(timeRangeSqlInterval(timeRange)).toBeNull();
    },
  );
});

describe('buildWindowFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates the current window to buildTimeRangeFilter', () => {
    const sql = render(buildWindowFilter(TimeRange.Month, 'c."createdAt"', 'current'));

    expect(sql).toContain('AND c."createdAt" >= NOW() - INTERVAL \'30 days\'');
  });

  it('bounds the previous window on both sides so it cannot overlap the current one', () => {
    const sql = render(buildWindowFilter(TimeRange.Month, 'c."createdAt"', 'previous'));

    expect(sql).toContain('>= NOW() - INTERVAL \'30 days\' - INTERVAL \'30 days\'');
    expect(sql).toContain('< NOW() - INTERVAL \'30 days\'');
  });

  it('starts the previous-window predicate with AND so it appends to a WHERE clause', () => {
    const sql = render(buildWindowFilter(TimeRange.Month, 'c."createdAt"', 'previous'));

    expect(sql.trimStart().startsWith('AND')).toBe(true);
  });

  it('selects nothing for the previous window of the forever range', () => {
    const sql = render(buildWindowFilter(TimeRange.Forever, 'c."createdAt"', 'previous'));

    expect(sql).toContain('AND FALSE');
  });
});

describe('buildSinceWindowFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reaches back two intervals for the previous window without an upper bound', () => {
    const sql = render(buildSinceWindowFilter(TimeRange.Month, 'ar."timestamp"', 'previous'));

    expect(sql).toContain('>= NOW() - INTERVAL \'30 days\' - INTERVAL \'30 days\'');
    expect(sql).not.toContain('<');
  });

  it('reaches back one extra calendar year for year to date', () => {
    const sql = render(buildSinceWindowFilter(TimeRange.YearToDate, 'ar."timestamp"', 'previous'));

    expect(sql).toContain('>= date_trunc(\'year\', NOW()) - INTERVAL \'1 year\'');
  });

  it('applies no bound at all for the forever range', () => {
    const sql = render(buildSinceWindowFilter(TimeRange.Forever, 'ar."timestamp"', 'previous'));

    expect(sql).toBe('');
  });

  it('matches buildTimeRangeFilter for the current window', () => {
    const sql = render(buildSinceWindowFilter(TimeRange.Week, 'ar."timestamp"', 'current'));

    expect(sql).toContain('AND ar."timestamp" >= NOW() - INTERVAL \'7 days\'');
  });
});
