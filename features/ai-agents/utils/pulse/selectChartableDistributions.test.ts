import {
  MAX_CHART_BARS,
  MAX_CHART_VALUES,
  REPEAT_RATIO,
  capBars,
  isChartable,
  mergeOnNormalizedValue,
  normalizeChartValue,
} from '@/features/ai-agents/utils/pulse/selectChartableDistributions';

const count = (value: string, total: number, defaultedCount = 0) => ({ value, count: total, defaultedCount });

describe('normalizeChartValue', () => {
  it('ignores case and extra spacing', () => {
    expect(normalizeChartValue('  Very   Positive ')).toBe('very positive');
  });
});

describe('mergeOnNormalizedValue', () => {
  it('merges spellings that differ only in case or spacing, labelled with the most common one', () => {
    expect(mergeOnNormalizedValue([count('positive', 2), count('Positive', 5, 1), count(' Positive ', 1)]))
      .toEqual([count('Positive', 8, 1)]);
  });

  it('keeps different answers apart', () => {
    expect(mergeOnNormalizedValue([count('Yes', 3), count('No', 2)])).toEqual([count('Yes', 3), count('No', 2)]);
  });
});

describe('isChartable', () => {
  it('never charts a column with no answers', () => {
    expect(isChartable(0, 100, true)).toBe(false);
  });

  it('always charts a column with declared allowed values', () => {
    expect(isChartable(100, 10, true)).toBe(true);
  });

  it('charts up to the distinct-value limit', () => {
    expect(isChartable(MAX_CHART_VALUES, 30, false)).toBe(true);
  });

  it('charts past the limit only when answers still repeat often', () => {
    const distinct = MAX_CHART_VALUES + 1;

    expect(isChartable(distinct, Math.ceil(distinct / REPEAT_RATIO), false)).toBe(true);
    expect(isChartable(distinct, distinct + 1, false)).toBe(false);
  });
});

describe('capBars', () => {
  it('leaves a short list alone', () => {
    const counts = [count('A', 2), count('B', 1)];

    expect(capBars(counts)).toEqual(counts);
  });

  it('keeps every step of an all-numeric scale', () => {
    const counts = Array.from({ length: MAX_CHART_BARS + 5 }, (_, index) => count(String(index), 1));

    expect(capBars(counts)).toEqual(counts);
  });

  it('keeps the most common answers and folds the rest into Other', () => {
    const counts = Array.from({ length: MAX_CHART_BARS + 3 }, (_, index) => count(`value ${index}`, index + 1));
    const capped = capBars(counts);

    expect(capped).toHaveLength(MAX_CHART_BARS + 1);
    expect(capped[0]).toEqual(count(`value ${MAX_CHART_BARS + 2}`, MAX_CHART_BARS + 3));
    expect(capped[MAX_CHART_BARS]).toEqual(count('Other (3 values)', 6));
  });
});
