import { Prisma } from '@prisma/client';
import { TimeRange } from '@/features/context-studio/types/context-studio';

type PresetWindow = {
  // Postgres interval literal for the rolling lower bound. Null when the preset
  // is not a rolling window (year to date, forever).
  sqlInterval: string | null;
  // The same window in days, for callers that filter with a JS Date instead of
  // raw SQL. Null follows sqlInterval.
  days: number | null;
};

// The single source of truth for the six presets. Declared as a full Record so a
// new TimeRange member cannot be added without defining its window.
const WINDOWS: Record<TimeRange, PresetWindow> = {
  [TimeRange.Day]: { sqlInterval: '24 hours', days: 1 },
  [TimeRange.Week]: { sqlInterval: '7 days', days: 7 },
  [TimeRange.Month]: { sqlInterval: '30 days', days: 30 },
  [TimeRange.Year]: { sqlInterval: '365 days', days: 365 },
  [TimeRange.YearToDate]: { sqlInterval: null, days: null },
  [TimeRange.Forever]: { sqlInterval: null, days: null },
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// The raw interval literal, for callers that embed the bound inline in a larger
// expression rather than as a standalone predicate.
export function timeRangeSqlInterval(timeRange: TimeRange): string | null {
  return WINDOWS[timeRange].sqlInterval;
}

// Turns a preset into a SQL lower bound on a timestamp column. `field` is a
// pre-quoted column reference (e.g. c."createdAt") inserted with Prisma.raw, so
// callers must never pass user input here.
export function buildTimeRangeFilter(timeRange: TimeRange, field: string): Prisma.Sql {
  const start = buildTimeRangeStart(timeRange);
  if (start === null) {
    return Prisma.empty;
  }

  return Prisma.sql`AND ${Prisma.raw(field)} >= ${start}`;
}

// The lower bound as a bare SQL expression rather than a predicate, for callers
// that embed it inside a larger expression — `generate_series` starts, mainly.
// Null means the range is unbounded and the caller supplies its own fallback
// (typically a `MIN(...)` subquery over the earliest row).
export function buildTimeRangeStart(timeRange: TimeRange): Prisma.Sql | null {
  if (timeRange === TimeRange.YearToDate) {
    return Prisma.sql`date_trunc('year', NOW())`;
  }

  const interval = WINDOWS[timeRange].sqlInterval;
  if (interval === null) {
    return null;
  }

  return Prisma.sql`NOW() - INTERVAL '${Prisma.raw(interval)}'`;
}

// The window immediately preceding the current one, as a half-open predicate on
// `field`, for period-over-period comparisons. Null for Forever, which has no
// preceding window.
//
// Year to date is calendar-anchored, so there is no fixed span to double. It
// compares against the same calendar span one year back instead — a product
// decision, not a mechanical translation of the rolling case.
export function buildPreviousPeriodFilter(
  timeRange: TimeRange,
  field: string,
): Prisma.Sql | null {
  if (timeRange === TimeRange.YearToDate) {
    return Prisma.sql`${Prisma.raw(field)} >= date_trunc('year', NOW()) - INTERVAL '1 year'
      AND ${Prisma.raw(field)} < NOW() - INTERVAL '1 year'`;
  }

  const interval = WINDOWS[timeRange].sqlInterval;
  if (interval === null) {
    return null;
  }

  return Prisma.sql`${Prisma.raw(field)} >= NOW() - INTERVAL '${Prisma.raw(interval)}' - INTERVAL '${Prisma.raw(interval)}'
    AND ${Prisma.raw(field)} < NOW() - INTERVAL '${Prisma.raw(interval)}'`;
}

// The same window as a JS Date, for callers filtering through a Prisma
// WhereInput. Null means no lower bound.
//
// Year to date truncates in UTC while buildTimeRangeFilter's date_trunc runs in
// the database session's time zone, so the two can disagree by a few hours on
// New Year's Day. Accepted rather than threading a time zone through every
// caller.
export function resolveTimeRangeStart(timeRange: TimeRange, now: Date): Date | null {
  if (timeRange === TimeRange.YearToDate) {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  const days = WINDOWS[timeRange].days;
  if (days === null) {
    return null;
  }

  return new Date(now.getTime() - days * MILLISECONDS_PER_DAY);
}
