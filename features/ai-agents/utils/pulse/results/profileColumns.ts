import { formatColumnLabel } from '@/features/ai-agents/utils/pulse/columnLetters';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import {
  normalizeAnswer,
  parseDateAnswer,
  parseNumericAnswer,
} from '@/features/ai-agents/utils/pulse/results/parseAnswers';
import {
  capBars,
  isChartable,
  mergeOnNormalizedValue,
} from '@/features/ai-agents/utils/pulse/selectChartableDistributions';
import type {
  PulseColumnProfile,
  PulseColumnSource,
  PulseHistogramBin,
  PulseSurveyColumn,
  PulseToolColumn,
  PulseValueCount,
} from '@/features/ai-agents/types/pulse/results';

export const IDENTIFIER_DISTINCT_PERCENT = 95;
// A column needs more than this many distinct answers to be an identifier.
export const IDENTIFIER_MIN_DISTINCT = 25;
export const PARSED_PERCENT = 90;
export const MAX_HISTOGRAM_BINS = 10;
// Whole-number columns with at most this many distinct values are rating scales, charted as bars.
export const SCALE_MAX_DISTINCT = 11;

type ProfileBase = Pick<PulseColumnProfile, 'key' | 'label' | 'source' | 'answeredCount' | 'rowCount' | 'fallbackCount'>;

type ColumnInput = {
  base: ProfileBase;
  answers: string[];
  allowedValues: string[];
};

export function surveyColumnKey(letter: string): string {
  return `survey:${letter}`;
}

export function toolColumnKey(fieldName: string): string {
  return `tool:${fieldName}`;
}

// A cell's answer, or null when it holds none: blank, or a tool cell the model could not fill.
export function toAnswer(value: string, source: PulseColumnSource): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0 || (source === 'tool' && trimmed === MATRIX_FALLBACK_VALUE)) {
    return null;
  }

  return trimmed;
}

export function columnValuesByKey(
  surveyColumns: PulseSurveyColumn[],
  toolColumns: PulseToolColumn[],
): Map<string, { source: PulseColumnSource; values: string[] }> {
  const map = new Map<string, { source: PulseColumnSource; values: string[] }>();

  surveyColumns.forEach((column) => map.set(surveyColumnKey(column.letter), { source: 'survey', values: column.values }));
  toolColumns.forEach((column) => map.set(toolColumnKey(column.fieldName), { source: 'tool', values: column.values }));

  return map;
}

function atLeastPercent(part: number, whole: number, percent: number): boolean {
  return part * 100 >= whole * percent;
}

function isNumericValue(value: string): boolean {
  return parseNumericAnswer(value) !== null;
}

// Counts per value with spelling variants merged; declared allowed values keep their spelling and appear even at zero.
function countValues(answers: string[], allowedValues: string[]): PulseValueCount[] {
  const raw = new Map<string, number>();
  answers.forEach((answer) => raw.set(answer, (raw.get(answer) ?? 0) + 1));

  const merged = mergeOnNormalizedValue(
    Array.from(raw.entries(), ([value, count]) => ({ value, count, defaultedCount: 0 })),
  );
  const allowedByKey = new Map(allowedValues.map((value) => [normalizeAnswer(value), value]));
  const named = merged.map((entry) => ({
    value: allowedByKey.get(normalizeAnswer(entry.value)) ?? entry.value,
    count: entry.count,
  }));
  const present = new Set(named.map((entry) => normalizeAnswer(entry.value)));
  const unchosen = allowedValues
    .filter((value) => !present.has(normalizeAnswer(value)))
    .map((value) => ({ value, count: 0 }));
  const all = [...named, ...unchosen];

  // A numeric scale reads in order of its steps; anything else reads largest first.
  const sorted = all.every((entry) => isNumericValue(entry.value))
    ? [...all].sort((a, b) => (parseNumericAnswer(a.value) ?? 0) - (parseNumericAnswer(b.value) ?? 0))
    : [...all].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return capBars(sorted.map((entry) => ({ ...entry, defaultedCount: 0 })))
    .map(({ value, count }) => ({ value, count }));
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function histogram(sorted: number[]): PulseHistogramBin[] {
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (min === max) {
    return [{ from: min, to: max, count: sorted.length }];
  }

  const binCount = Math.min(MAX_HISTOGRAM_BINS, new Set(sorted).size);
  const width = (max - min) / binCount;
  const bins: PulseHistogramBin[] = Array.from({ length: binCount }, (_, index) => ({
    from: min + index * width,
    to: index === binCount - 1 ? max : min + (index + 1) * width,
    count: 0,
  }));

  sorted.forEach((value) => {
    bins[Math.min(Math.floor((value - min) / width), binCount - 1)].count += 1;
  });

  return bins;
}

function profileOne({ base, answers, allowedValues }: ColumnInput): PulseColumnProfile {
  if (answers.length === 0) {
    return { ...base, kind: 'empty' };
  }

  if (allowedValues.length > 0) {
    return { ...base, kind: 'categorical', counts: countValues(answers, allowedValues) };
  }

  const numbers = answers
    .map(parseNumericAnswer)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (atLeastPercent(numbers.length, answers.length, PARSED_PERCENT)) {
    const isScale = numbers.length === answers.length
      && numbers.every(Number.isInteger)
      && new Set(numbers).size <= SCALE_MAX_DISTINCT;

    // countValues orders an all-numeric column by value.
    if (isScale) {
      return { ...base, kind: 'categorical', counts: countValues(answers, []) };
    }

    return {
      ...base,
      kind: 'numeric',
      min: numbers[0],
      max: numbers[numbers.length - 1],
      mean: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      median: median(numbers),
      bins: histogram(numbers),
    };
  }

  const days = answers
    .map(parseDateAnswer)
    .filter((value): value is Date => value !== null)
    .map((date) => date.toISOString())
    .sort();

  if (atLeastPercent(days.length, answers.length, PARSED_PERCENT)) {
    const months = new Map<string, number>();
    days.forEach((day) => months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + 1));

    return {
      ...base,
      kind: 'date',
      min: days[0].slice(0, 10),
      max: days[days.length - 1].slice(0, 10),
      months: Array.from(months.entries(), ([value, count]) => ({ value, count })),
    };
  }

  // Only answers that are not mostly numbers or dates can be an identifier.
  const distinct = new Set(answers.map(normalizeAnswer)).size;

  if (distinct > IDENTIFIER_MIN_DISTINCT && atLeastPercent(distinct, answers.length, IDENTIFIER_DISTINCT_PERCENT)) {
    return { ...base, kind: 'identifier', distinctCount: distinct };
  }

  if (isChartable(distinct, answers.length, false)) {
    return { ...base, kind: 'categorical', counts: countValues(answers, []) };
  }

  return { ...base, kind: 'freeText' };
}

function answersOf(values: string[], source: PulseColumnSource): string[] {
  return values
    .map((value) => toAnswer(value, source))
    .filter((answer): answer is string => answer !== null);
}

/**
 * One profile per column: survey columns in sheet order, then tool columns in matrix order.
 * Every profile shares `rowCount` so shares across columns are comparable; tool fallbacks
 * are counted apart and are never an answer.
 */
export default function profileColumns(params: {
  surveyColumns: PulseSurveyColumn[];
  toolColumns: PulseToolColumn[];
  rowCount: number;
}): PulseColumnProfile[] {
  const survey = params.surveyColumns.map((column) => {
    const answers = answersOf(column.values, 'survey');

    return profileOne({
      base: {
        key: surveyColumnKey(column.letter),
        label: formatColumnLabel(column.letter, column.header),
        source: 'survey',
        answeredCount: answers.length,
        rowCount: params.rowCount,
        fallbackCount: 0,
      },
      answers,
      allowedValues: [],
    });
  });

  const tool = params.toolColumns.map((column) => {
    const answers = answersOf(column.values, 'tool');

    return profileOne({
      base: {
        key: toolColumnKey(column.fieldName),
        label: column.fieldName,
        source: 'tool',
        answeredCount: answers.length,
        rowCount: params.rowCount,
        fallbackCount: column.values.filter((value) => value.trim() === MATRIX_FALLBACK_VALUE).length,
      },
      answers,
      allowedValues: column.allowedValues,
    });
  });

  return [...survey, ...tool];
}
