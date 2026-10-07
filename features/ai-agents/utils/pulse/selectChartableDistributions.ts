import type { PulseDistribution } from '@/features/ai-agents/types/pulse/surveyAnalysis';

// A field charts when its answers repeat. Past this many distinct answers a field only
// charts if its answers still repeat often relative to how many responses there were.
export const MAX_CHART_VALUES = 25;
export const REPEAT_RATIO = 0.4;
export const MAX_CHART_BARS = 12;
const NUMERIC_VALUE = /^-?\d+(\.\d+)?$/;

type DistributionCount = PulseDistribution['counts'][number];

// One owner for the rolled-up bucket: every producer builds it here and every consumer recognizes it here.
export function otherBucketLabel(valueCount: number): string {
  return `Other (${valueCount} values)`;
}

export function isOtherBucket(value: string): boolean {
  return /^Other \(\d+ values\)$/.test(value);
}

type MergedValue = {
  count: number;
  defaultedCount: number;
  // How often each original spelling was answered, so the bar can be labelled with the
  // wording most respondents actually used rather than whichever row was grouped first.
  spellings: Map<string, number>;
};

export function normalizeChartValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function preferredSpelling(spellings: Map<string, number>): string {
  return Array.from(spellings.entries())
    .sort(([aValue, aCount], [bValue, bCount]) => bCount - aCount || aValue.localeCompare(bValue))[0][0];
}

// Answers the model wrote with different casing or spacing are the same answer, so they
// share a bar. Declared allowed values normalize to themselves and are unaffected.
export function mergeOnNormalizedValue(counts: DistributionCount[]): DistributionCount[] {
  const merged = new Map<string, MergedValue>();

  counts.forEach((entry) => {
    const key = normalizeChartValue(entry.value);
    const existing = merged.get(key) ?? { count: 0, defaultedCount: 0, spellings: new Map<string, number>() };

    existing.count += entry.count;
    existing.defaultedCount += entry.defaultedCount;
    existing.spellings.set(entry.value, (existing.spellings.get(entry.value) ?? 0) + entry.count);

    merged.set(key, existing);
  });

  return Array.from(merged.values()).map((value) => ({
    value: preferredSpelling(value.spellings),
    count: value.count,
    defaultedCount: value.defaultedCount,
  }));
}

export function isChartable(distinct: number, responseCount: number, hasAllowedValues: boolean): boolean {
  if (distinct === 0) {
    return false;
  }

  if (hasAllowedValues || distinct <= MAX_CHART_VALUES) {
    return true;
  }

  return responseCount > 0 && distinct <= responseCount * REPEAT_RATIO;
}

export function capBars(counts: DistributionCount[]): DistributionCount[] {
  // An all-numeric field reads as a scale, which is only meaningful with every step
  // present and in order, so it keeps all of its values.
  if (counts.length <= MAX_CHART_BARS || counts.every((entry) => NUMERIC_VALUE.test(entry.value))) {
    return counts;
  }

  const ranked = [...counts].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  const rolled = ranked.slice(MAX_CHART_BARS);

  return [
    ...ranked.slice(0, MAX_CHART_BARS),
    {
      value: otherBucketLabel(rolled.length),
      count: rolled.reduce((sum, entry) => sum + entry.count, 0),
      defaultedCount: rolled.reduce((sum, entry) => sum + entry.defaultedCount, 0),
    },
  ];
}
