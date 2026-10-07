import type { PulseColumnProfile, PulseValueCount } from '@/features/ai-agents/types/pulse/results';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import {
  bucketDates,
  describeAnswered,
  fillMonths,
  formatShare,
  renderBreakdownFigure,
  renderColumnChart,
  renderColumnFigure,
  summarizeBreakdown,
  summarizeProfile,
} from '@/features/ai-agents/utils/pulse/results/charts';
import {
  ESCAPED_INJECTION,
  INJECTION,
  NETWORK_REFERENCE,
  buildProfile,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

function column(key: string): PulseColumnProfile {
  const found = buildProfile().columns.find((candidate) => candidate.key === key);
  if (!found) {
    throw new Error(`fixture column ${key} missing`);
  }
  return found;
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

function categoricalColumn(counts: PulseValueCount[], answeredCount: number): PulseColumnProfile {
  const base = column('survey:B');
  if (base.kind !== 'categorical') {
    throw new Error('fixture column B must be categorical');
  }
  return { ...base, answeredCount, counts };
}

function dateColumn(months: PulseValueCount[]): PulseColumnProfile {
  const base = column('survey:D');
  if (base.kind !== 'date') {
    throw new Error('fixture column D must be a date');
  }
  return { ...base, months, min: `${months[0].value}-01`, max: `${months[months.length - 1].value}-01` };
}

describe('formatShare', () => {
  it('rounds to a whole percent', () => {
    expect(formatShare(1, 3)).toBe('33%');
  });

  it('shows a tiny non-zero share as under one percent', () => {
    expect(formatShare(1, 400)).toBe('<1%');
  });

  it('reads zero when there is no denominator', () => {
    expect(formatShare(0, 0)).toBe('0%');
  });
});

describe('describeAnswered', () => {
  it('states answered of rows for a survey column', () => {
    expect(describeAnswered(column('survey:B'))).toBe('Answered by 48 of 50');
  });

  it('adds the fallback share separately for a tool column', () => {
    expect(describeAnswered(column('tool:Sentiment'))).toBe(
      `Answered by 47 of 50 · 3 ${MATRIX_FALLBACK_VALUE} (6% of rows)`,
    );
  });
});

describe('renderColumnChart', () => {
  it('draws one bar per value for a categorical column, with an accessible title', () => {
    const svg = renderColumnChart(column('survey:B'), 'chart-1') ?? '';

    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="chart-1-title chart-1-desc"');
    expect(svg).toContain('<title id="chart-1-title">B – Region');
    expect(svg).toContain('Answered by 48 of 50');
    expect(countMatches(svg, /class="bar"/g)).toBe(3);
    expect(svg).not.toContain('class="bar fallback"');
  });

  it('draws the fallback as its own labelled bar for a tool column', () => {
    const svg = renderColumnChart(column('tool:Sentiment'), 'chart-2') ?? '';

    expect(countMatches(svg, /class="bar"/g)).toBe(3);
    expect(countMatches(svg, /class="bar fallback"/g)).toBe(1);
    expect(svg).toContain(MATRIX_FALLBACK_VALUE);
  });

  it('draws one column per histogram bin for a numeric column', () => {
    const svg = renderColumnChart(column('survey:C'), 'chart-3') ?? '';

    expect(countMatches(svg, /class="bar"/g)).toBe(5);
    expect(svg).toContain('Answered by 45 of 50');
  });

  it('draws one column per month for a date column', () => {
    const svg = renderColumnChart(column('survey:D'), 'chart-4') ?? '';

    expect(countMatches(svg, /class="bar"/g)).toBe(3);
    expect(svg).toContain('2026-02');
  });

  it.each(['survey:A', 'survey:E', 'survey:F'])('returns no chart for %s', (key) => {
    expect(renderColumnChart(column(key), 'chart-5')).toBeNull();
  });

  it('buckets a date column by year once its span is too wide to read as months', () => {
    const svg = renderColumnChart(dateColumn([
      { value: '1965-03', count: 1 },
      { value: '2005-11', count: 2 },
    ]), 'chart-9') ?? '';

    expect(svg).toContain('answers by year');
    expect(svg).toContain('1965');
    expect(svg).toContain('2005');
    expect(svg).not.toContain('1965-03');
  });

  it('still charts months for a span inside the cap', () => {
    const svg = renderColumnChart(dateColumn([
      { value: '2024-01', count: 1 },
      { value: '2026-01', count: 2 },
    ]), 'chart-10') ?? '';

    expect(svg).toContain('answers by month');
    expect(svg).toContain('2024-01');
  });

  // One mistyped year among real dates must not draw eighteen centuries of one-pixel bars.
  it('groups an outlier year into year ranges so the axis stays readable', () => {
    const svg = renderColumnChart(dateColumn([
      { value: '0202-01', count: 1 },
      { value: '2026-01', count: 4 },
    ]), 'chart-17') ?? '';

    expect(svg).toContain('answers by year range');
    expect(countMatches(svg, /class="bar"/g)).toBeLessThanOrEqual(48);
    expect(svg).toContain('0202–0240');
  });

  it('counts every answer once no matter which bucket it lands in', () => {
    const { buckets } = bucketDates([
      { value: '0202-01', count: 1 },
      { value: '1900-06', count: 3 },
      { value: '2026-01', count: 4 },
    ]);

    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(8);
  });

  // A column nobody answered, or one the model failed on every row, still renders a real figure.
  it('draws no bars and no NaN for an all-zero categorical column', () => {
    const svg = renderColumnChart(categoricalColumn([
      { value: 'Yes', count: 0 },
      { value: 'No', count: 0 },
    ], 0), 'chart-11') ?? '';

    expect(countMatches(svg, /class="bar"/g)).toBe(0);
    expect(svg).not.toContain('NaN');
  });

  it('draws no bars and no NaN for an all-zero histogram', () => {
    const base = column('survey:C');
    if (base.kind !== 'numeric') {
      throw new Error('fixture column C must be numeric');
    }
    const svg = renderColumnChart({
      ...base,
      answeredCount: 0,
      bins: base.bins.map((bin) => ({ ...bin, count: 0 })),
    }, 'chart-12') ?? '';

    expect(countMatches(svg, /class="bar"/g)).toBe(0);
    expect(svg).not.toContain('NaN');
  });

  it('draws a single-value categorical column as one full-width bar', () => {
    const svg = renderColumnChart(categoricalColumn([{ value: 'Yes', count: 12 }], 12), 'chart-13') ?? '';

    expect(countMatches(svg, /class="bar"/g)).toBe(1);
    expect(svg).not.toContain('NaN');
  });

  it('draws only the fallback bar for a tool column where every row fell back', () => {
    const base = column('tool:Sentiment');
    if (base.kind !== 'categorical') {
      throw new Error('fixture column Sentiment must be categorical');
    }
    const svg = renderColumnChart({
      ...base,
      answeredCount: 0,
      counts: [],
      fallbackCount: base.rowCount,
    }, 'chart-14') ?? '';

    expect(countMatches(svg, /class="bar fallback"/g)).toBe(1);
    expect(countMatches(svg, /class="bar"/g)).toBe(0);
    expect(svg).not.toContain('NaN');
  });

  it('shortens a long answer label on the axis and keeps the whole text as its title', () => {
    const label = 'Strongly agree with every part of this statement';
    const svg = renderColumnChart(categoricalColumn([{ value: label, count: 4 }], 4), 'chart-15') ?? '';

    expect(svg).toContain('Strongly agree with every par…');
    expect(svg).toContain(`<title>${label}</title>`);
  });

  it('never references the network', () => {
    const svgs = buildProfile().columns.map((profile, index) => renderColumnChart(profile, `c${index}`) ?? '');

    expect(svgs.join('')).not.toMatch(NETWORK_REFERENCE);
  });
});

describe('fillMonths', () => {
  it('fills the months nobody answered in with zero, across a year boundary', () => {
    expect(fillMonths([{ value: '2025-11', count: 2 }, { value: '2026-02', count: 3 }])).toEqual([
      { value: '2025-11', count: 2 },
      { value: '2025-12', count: 0 },
      { value: '2026-01', count: 0 },
      { value: '2026-02', count: 3 },
    ]);
  });

  it('returns no months for a column with no dates', () => {
    expect(fillMonths([])).toEqual([]);
  });
});

describe('renderColumnFigure', () => {
  it('shows the kind summary and note when the column has no chart', () => {
    const html = renderColumnFigure(column('survey:A'), 'chart-6', { note: 'IDs only.' });

    expect(html).toContain('A – Respondent ID');
    expect(html).toContain('50 distinct values');
    expect(html).toContain('IDs only.');
    expect(html).not.toContain('<svg');
  });

  it('includes a data table view for a charted column', () => {
    const html = renderColumnFigure(column('survey:B'), 'chart-7');

    expect(html).toContain('<details class="data-table">');
    expect(html).toContain('<td>North</td>');
  });

  // A four-decade span would otherwise put one table row per month into every output.
  it('lists a wide date span by year in its data table, one row per year', () => {
    const html = renderColumnFigure(dateColumn([
      { value: '1965-03', count: 1 },
      { value: '2005-11', count: 2 },
    ]), 'chart-16');

    expect(html).toContain('<th scope="col">Year</th>');
    expect(countMatches(html, /<tr><td>/g)).toBe(2005 - 1965 + 1);
  });

  // An eighteen-century span is capped in the table too, not just on the axis.
  it('lists an outlier date span by year range, at most one row per range', () => {
    const html = renderColumnFigure(dateColumn([
      { value: '0202-01', count: 1 },
      { value: '2026-01', count: 4 },
    ]), 'chart-18');

    expect(html).toContain('<th scope="col">Years</th>');
    expect(countMatches(html, /<tr><td>/g)).toBeLessThanOrEqual(48);
  });

  it('escapes the label, values, and note', () => {
    const base = column('survey:B');
    if (base.kind !== 'categorical') {
      throw new Error('fixture column B must be categorical');
    }
    const html = renderColumnFigure(
      { ...base, label: INJECTION, counts: [{ value: INJECTION, count: 3 }] },
      'chart-8',
      { note: INJECTION },
    );

    expect(html).not.toContain(INJECTION);
    expect(html).toContain(ESCAPED_INJECTION);
  });

  // A featured chart is titled by the finding it supports, with its column named underneath.
  it('uses a given heading in place of the column label', () => {
    const html = renderColumnFigure(column('survey:B'), 'chart-19', { heading: 'North leads the regions' });

    expect(html).toContain('<h3>North leads the regions</h3>');
    expect(html).toContain('B – Region · Answered by 48 of 50');
  });

  it('escapes a given heading', () => {
    const html = renderColumnFigure(column('survey:B'), 'chart-20', { heading: INJECTION });

    expect(html).not.toContain(INJECTION);
    expect(html).toContain(ESCAPED_INJECTION);
  });
});

describe('summarizeProfile', () => {
  it('names the most common categorical answer with its share', () => {
    expect(summarizeProfile(column('survey:B'))).toBe('Most common: North, 42% (20 of 48).');
  });

  it('gives median, mean, and range for a numeric column', () => {
    expect(summarizeProfile(column('survey:C'))).toBe('Median 1,500; mean 1,830.5; range 100 to 5,000.');
  });

  it('gives the date range for a date column', () => {
    expect(summarizeProfile(column('survey:D'))).toBe('From 2026-01-04 to 2026-03-28.');
  });
});

describe('renderBreakdownFigure', () => {
  const breakdown = buildProfile().breakdowns[0];

  it('draws an overall row plus one row per group, with a legend', () => {
    const html = renderBreakdownFigure(breakdown, 50, 'breakdown-1');

    expect(html).toContain('Sentiment by B – Region');
    expect(countMatches(html, /class="stack-row"/g)).toBe(4);
    expect(countMatches(html, /class="legend-item"/g)).toBe(3);
    expect(html).toContain('Answered by 47 of 50');
  });

  it('folds values past the eighth into Other', () => {
    const values = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10'];
    const counts = values.map(() => 1);
    const html = renderBreakdownFigure(
      { ...breakdown, values, overall: counts, groups: [{ group: 'All', total: 10, counts }] },
      10,
      'breakdown-2',
    );

    expect(countMatches(html, /class="legend-item"/g)).toBe(8);
    expect(html).toContain('Other (3 values)');
  });

  it('names the largest gap between a group and overall', () => {
    expect(summarizeBreakdown(breakdown)).toBe(
      'Sentiment by B – Region: biggest difference is North at 70% Positive vs 53% overall.',
    );
  });
});
