import { normalizeChartValue } from '@/features/ai-agents/utils/pulse/selectChartableDistributions';

// Optional sign, optional currency symbol, optional sign, digits (grouped by thousands or not), optional decimals, optional %.
const NUMERIC_ANSWER = /^([+-]?)\s*[$€£¥]?\s*([+-]?)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)\s*%?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const ISO_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;
const MONTH_FIRST_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;

function isRealDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * A typed number, allowing the formatting people use in spreadsheets: a currency symbol,
 * thousands separators, a trailing percent sign, and surrounding space. '45%' reads as 45.
 * Anything with other words in it is not a number.
 */
export function parseNumericAnswer(value: string): number | null {
  const match = NUMERIC_ANSWER.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, leadingSign, innerSign, digits] = match;

  if (leadingSign && innerSign) {
    return null;
  }

  const magnitude = Number(digits.replace(/,/g, ''));

  return (leadingSign || innerSign) === '-' ? -magnitude : magnitude;
}

// An ISO date or timestamp (what a spreadsheet date cell is read as), or a month-first m/d/yyyy date.
export function parseDateAnswer(value: string): Date | null {
  const trimmed = value.trim();
  const iso = ISO_DATE.exec(trimmed);

  if (iso) {
    if (!isRealDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))) {
      return null;
    }
    // A date or a zoneless timestamp is read as UTC so the result never depends on the server's time zone.
    const zoned = trimmed.length === 10 ? `${trimmed}T00:00:00.000Z` : trimmed;
    const parsed = new Date(ISO_ZONE.test(zoned) ? zoned : `${zoned}Z`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const monthFirst = MONTH_FIRST_DATE.exec(trimmed);

  if (monthFirst) {
    const [month, day, year] = [Number(monthFirst[1]), Number(monthFirst[2]), Number(monthFirst[3])];

    return isRealDay(year, month, day) ? new Date(Date.UTC(year, month - 1, day)) : null;
  }

  return null;
}

// Answers differing only in case or spacing are the same answer.
export function normalizeAnswer(value: string): string {
  return normalizeChartValue(value);
}
