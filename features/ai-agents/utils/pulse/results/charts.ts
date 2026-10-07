import type {
  PulseBreakdown,
  PulseColumnProfile,
  PulseReportInput,
  PulseValueCount,
} from '@/features/ai-agents/types/pulse/results';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import { otherBucketLabel } from '@/features/ai-agents/utils/pulse/selectChartableDistributions';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';
import {
  PULSE_OTHER_COLOR,
  PULSE_OTHER_LABEL_INK,
  PULSE_OUTPUT_COLORS,
  PULSE_SERIES_COLORS,
  PULSE_SERIES_LABEL_INK,
} from '@/features/ai-agents/utils/pulse/results/theme';

export const NARRATIVE_MISSING_BANNER = 'The written summary couldn\'t be generated for this run.';

const CHART_WIDTH = 640;
const BAR_THICKNESS = 16;
const BAR_ROW = 28;
const BAR_RADIUS = 4;
const SURFACE_GAP = 2;
const CATEGORY_LABEL_WIDTH = 200;
const VALUE_LABEL_WIDTH = 104;
const MAX_LABEL_CHARS = 30;
const CHART_TOP = 8;
const FALLBACK_ROW_GAP = 12;
const COLUMN_CHART_HEIGHT = 216;
const COLUMN_PLOT_TOP = 20;
const COLUMN_PLOT_BOTTOM = 184;
const COLUMN_PLOT_LEFT = 48;
const COLUMN_PLOT_RIGHT = 624;
const MAX_COLUMN_WIDTH = 24;
const MAX_AXIS_LABELS = 12;
// Four years of months; past that a date column is bucketed by year, then by year range.
const MAX_DATE_BARS = 48;
const MAX_BREAKDOWN_SERIES = 8;
const MIN_INSIDE_LABEL_WIDTH = 40;
const MIN_GROUP_ANSWERS = 5;
const STACK_RIGHT_PADDING = 16;

type CategoricalProfile = Extract<PulseColumnProfile, { kind: 'categorical' }>;
type NumericProfile = Extract<PulseColumnProfile, { kind: 'numeric' }>;
type DateProfile = Extract<PulseColumnProfile, { kind: 'date' }>;
type DateUnit = 'month' | 'year' | 'period';

const DATE_UNIT_TITLES: Record<DateUnit, string> = { month: 'month', year: 'year', period: 'year range' };
const DATE_UNIT_HEADINGS: Record<DateUnit, string> = { month: 'Month', year: 'Year', period: 'Years' };

type VerticalBar = { label: string; tooltip: string; count: number };

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatShare(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) {
    return '0%';
  }
  const percent = (part / whole) * 100;
  if (percent < 1) {
    return '<1%';
  }
  return `${Math.round(percent)}%`;
}

export function formatRunDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function plural(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// Rounds SVG coordinates so the markup stays short and deterministic.
function px(value: number): number {
  return Math.round(value * 10) / 10;
}

function truncateLabel(text: string): string {
  if (text.length <= MAX_LABEL_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…`;
}

export function describeAnswered(profile: PulseColumnProfile): string {
  const answered = `Answered by ${formatCount(profile.answeredCount)} of ${formatCount(profile.rowCount)}`;
  if (profile.source !== 'tool' || profile.fallbackCount === 0) {
    return answered;
  }
  const fallbackShare = formatShare(profile.fallbackCount, profile.rowCount);
  return `${answered} · ${formatCount(profile.fallbackCount)} ${MATRIX_FALLBACK_VALUE} (${fallbackShare} of rows)`;
}

export function summarizeProfile(profile: PulseColumnProfile): string {
  switch (profile.kind) {
    case 'categorical': {
      const top = profile.counts[0];
      if (!top) {
        return 'No answers in the analyzed rows.';
      }
      const share = formatShare(top.count, profile.answeredCount);
      return `Most common: ${top.value}, ${share} (${formatCount(top.count)} of ${formatCount(profile.answeredCount)}).`;
    }
    case 'numeric':
      return `Median ${formatNumber(profile.median)}; mean ${formatNumber(profile.mean)}; range ${formatNumber(profile.min)} to ${formatNumber(profile.max)}.`;
    case 'date':
      return `From ${profile.min} to ${profile.max}.`;
    case 'freeText':
      return `Free-text answers from ${plural(profile.answeredCount, 'row')}; see the selected quotes.`;
    case 'identifier':
      return `Identifier column with ${formatCount(profile.distinctCount)} distinct values; not charted or quoted.`;
    case 'empty':
      return 'No answers in the analyzed rows.';
  }
}

export function summarizeBreakdown(breakdown: PulseBreakdown): string {
  const title = `${breakdown.toolLabel} by ${breakdown.groupLabel}`;
  const overallTotal = sum(breakdown.overall);
  let best: { group: string; value: string; count: number; total: number; gap: number } | null = null;

  for (const group of breakdown.groups) {
    if (group.total < MIN_GROUP_ANSWERS) {
      continue;
    }
    for (let index = 0; index < breakdown.values.length; index += 1) {
      const count = group.counts[index] ?? 0;
      const overallShare = overallTotal > 0 ? (breakdown.overall[index] ?? 0) / overallTotal : 0;
      const gap = Math.abs(count / group.total - overallShare);
      if (!best || gap > best.gap) {
        best = { group: group.group, value: breakdown.values[index], count, total: group.total, gap };
      }
    }
  }

  if (!best) {
    return `${title}: no group has at least ${MIN_GROUP_ANSWERS} answers.`;
  }

  const valueIndex = breakdown.values.indexOf(best.value);
  const overallShare = formatShare(breakdown.overall[valueIndex] ?? 0, overallTotal);
  return `${title}: biggest difference is ${best.group} at ${formatShare(best.count, best.total)} ${best.value} vs ${overallShare} overall.`;
}

export function buildMethodNotes(input: PulseReportInput): string[] {
  const { facts, profile, narrative } = input;
  const skipped = facts.failedRowCount === 0
    ? 'No rows were skipped.'
    : `${plural(facts.failedRowCount, 'failed row')} ${facts.failedRowCount === 1 ? 'was' : 'were'} skipped.`;
  const notes = [
    `${formatCount(facts.rowsAnalyzed)} of ${formatCount(facts.rowsInFile)} rows were analyzed. ${skipped}`,
    'Every share is of the rows that answered that column, not of all rows.',
  ];

  profile.columns.forEach((column) => {
    if (column.source === 'tool' && column.fallbackCount > 0) {
      notes.push(`${column.label}: ${formatCount(column.fallbackCount)} of ${formatCount(column.rowCount)} rows fell back to ${MATRIX_FALLBACK_VALUE} and are shown apart from the answers.`);
    }
  });
  profile.columns.forEach((column) => {
    if (column.kind === 'identifier') {
      notes.push(`${column.label} was treated as an identifier (${formatCount(column.distinctCount)} distinct values) and is not charted or quoted.`);
    }
  });

  notes.push('Quotes are verbatim answers, shortened to 300 characters at most.');
  notes.push(narrative
    ? `Numbers are computed from the data; the text is written by ${facts.modelName}.`
    : 'Numbers are computed from the data; the written summary couldn\'t be generated.');

  return notes;
}

export function renderHtmlDocument(title: string, css: string, body: string, script?: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${css}</style>`,
    '</head>',
    '<body>',
    body,
    script ? `<script>${script}</script>` : '',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function renderDataTable(caption: string, headers: string[], rows: string[][]): string {
  const head = headers
    .map((header, index) => `<th${index > 0 ? ' class="number"' : ''} scope="col">${escapeHtml(header)}</th>`)
    .join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell, index) => (index === 0 ? `<td>${escapeHtml(cell)}</td>` : `<td class="number">${escapeHtml(cell)}</td>`)).join('')}</tr>`)
    .join('');
  return `<details class="data-table"><summary>Show data</summary><table><caption>${escapeHtml(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></details>`;
}

// A bar anchored at x with a 4px rounded data-end on the right, square at the baseline.
function horizontalBarPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(BAR_RADIUS, width, height / 2);
  const end = px(x + width);
  const bottom = px(y + height);
  return `M${px(x)},${px(y)}H${px(end - r)}Q${end},${px(y)} ${end},${px(y + r)}V${px(bottom - r)}Q${end},${bottom} ${px(end - r)},${bottom}H${px(x)}Z`;
}

// A column growing up from the baseline at y + height, rounded at the top.
function verticalBarPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(BAR_RADIUS, height, width / 2);
  const right = px(x + width);
  const base = px(y + height);
  return `M${px(x)},${base}V${px(y + r)}Q${px(x)},${px(y)} ${px(x + r)},${px(y)}H${px(right - r)}Q${right},${px(y)} ${right},${px(y + r)}V${base}Z`;
}

// Rounds an axis maximum up to 1, 2, or 5 times a power of ten.
function niceMax(value: number): number {
  if (value <= 1) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  for (const multiple of [1, 2, 5, 10]) {
    if (multiple * power >= value) {
      return multiple * power;
    }
  }
  return 10 * power;
}

function openSvg(chartId: string, height: number, title: string, description: string): string {
  const id = escapeHtml(chartId);
  return `<svg class="chart" role="img" aria-labelledby="${id}-title ${id}-desc" viewBox="0 0 ${CHART_WIDTH} ${height}" preserveAspectRatio="xMinYMin meet"><title id="${id}-title">${escapeHtml(title)}</title><desc id="${id}-desc">${escapeHtml(description)}</desc>`;
}

function renderCategoricalChart(profile: CategoricalProfile, chartId: string): string {
  const rows = profile.counts.map((item) => ({
    label: item.value,
    count: item.count,
    share: formatShare(item.count, profile.answeredCount),
    fallback: false,
  }));
  if (profile.source === 'tool' && profile.fallbackCount > 0) {
    rows.push({
      label: MATRIX_FALLBACK_VALUE,
      count: profile.fallbackCount,
      share: `${formatShare(profile.fallbackCount, profile.rowCount)} of rows`,
      fallback: true,
    });
  }

  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const plotWidth = CHART_WIDTH - CATEGORY_LABEL_WIDTH - VALUE_LABEL_WIDTH;
  const hasFallbackRow = rows.some((row) => row.fallback);
  const height = CHART_TOP * 2 + rows.length * BAR_ROW + (hasFallbackRow ? FALLBACK_ROW_GAP : 0);

  const marks = rows.map((row, index) => {
    const rowTop = CHART_TOP + index * BAR_ROW + (row.fallback ? FALLBACK_ROW_GAP : 0);
    const middle = px(rowTop + BAR_ROW / 2);
    const width = (row.count / maxCount) * plotWidth;
    const tooltip = escapeHtml(`${row.label}: ${formatCount(row.count)} (${row.share})`);
    const label = `<text class="category" x="${CATEGORY_LABEL_WIDTH - 8}" y="${middle}" text-anchor="end" dominant-baseline="middle">${escapeHtml(truncateLabel(row.label))}<title>${escapeHtml(row.label)}</title></text>`;
    const bar = width > 0
      ? `<path class="${row.fallback ? 'bar fallback' : 'bar'}" d="${horizontalBarPath(CATEGORY_LABEL_WIDTH, rowTop + (BAR_ROW - BAR_THICKNESS) / 2, width, BAR_THICKNESS)}" fill="${row.fallback ? PULSE_OUTPUT_COLORS.fallback : PULSE_OUTPUT_COLORS.accent}"><title>${tooltip}</title></path>`
      : '';
    const value = `<text class="value" x="${px(CATEGORY_LABEL_WIDTH + width + 6)}" y="${middle}" dominant-baseline="middle">${escapeHtml(`${formatCount(row.count)} · ${row.share}`)}</text>`;
    return `<g>${label}${bar}${value}</g>`;
  });

  const baseline = `<line class="baseline" x1="${CATEGORY_LABEL_WIDTH}" x2="${CATEGORY_LABEL_WIDTH}" y1="${CHART_TOP}" y2="${height - CHART_TOP}"/>`;
  return `${openSvg(chartId, height, `${profile.label}: answer counts`, describeAnswered(profile))}${baseline}${marks.join('')}</svg>`;
}

// Columns on one y-axis. Histogram bins touch (a 2px surface gap); month columns are capped at 24px.
function renderVerticalBars(
  chartId: string,
  title: string,
  description: string,
  bars: VerticalBar[],
  axisLabels: Array<{ x: number; label: string }>,
  contiguous: boolean,
): string {
  const plotWidth = COLUMN_PLOT_RIGHT - COLUMN_PLOT_LEFT;
  const plotHeight = COLUMN_PLOT_BOTTOM - COLUMN_PLOT_TOP;
  const slot = plotWidth / Math.max(1, bars.length);
  const barWidth = contiguous ? Math.max(1, slot - SURFACE_GAP) : Math.max(1, Math.min(MAX_COLUMN_WIDTH, slot - SURFACE_GAP));
  const maxCount = Math.max(...bars.map((bar) => bar.count), 0);
  const axisMax = niceMax(maxCount);
  const ticks = axisMax % 2 === 0 ? [0, axisMax / 2, axisMax] : [0, axisMax];
  const tallest = bars.findIndex((bar) => bar.count === maxCount && maxCount > 0);

  const grid = ticks.map((tick) => {
    const y = px(COLUMN_PLOT_BOTTOM - (tick / axisMax) * plotHeight);
    const line = tick === 0
      ? `<line class="baseline" x1="${COLUMN_PLOT_LEFT}" x2="${COLUMN_PLOT_RIGHT}" y1="${y}" y2="${y}"/>`
      : `<line class="grid" x1="${COLUMN_PLOT_LEFT}" x2="${COLUMN_PLOT_RIGHT}" y1="${y}" y2="${y}"/>`;
    return `${line}<text class="axis" x="${COLUMN_PLOT_LEFT - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${formatCount(tick)}</text>`;
  });

  const marks = bars.map((bar, index) => {
    if (bar.count <= 0) {
      return '';
    }
    const height = (bar.count / axisMax) * plotHeight;
    const x = COLUMN_PLOT_LEFT + index * slot + (slot - barWidth) / 2;
    const y = COLUMN_PLOT_BOTTOM - height;
    const path = `<path class="bar" d="${verticalBarPath(x, y, barWidth, height)}" fill="${PULSE_OUTPUT_COLORS.accent}"><title>${escapeHtml(bar.tooltip)}</title></path>`;
    const cap = index === tallest
      ? `<text class="value" x="${px(x + barWidth / 2)}" y="${px(y - 6)}" text-anchor="middle">${formatCount(bar.count)}</text>`
      : '';
    return `${path}${cap}`;
  });

  const labels = axisLabels.map((item) => `<text class="axis" x="${px(item.x)}" y="${COLUMN_PLOT_BOTTOM + 18}" text-anchor="middle">${escapeHtml(item.label)}</text>`);

  return `${openSvg(chartId, COLUMN_CHART_HEIGHT, title, description)}${grid.join('')}${marks.join('')}${labels.join('')}</svg>`;
}

function renderHistogram(profile: NumericProfile, chartId: string): string {
  const bins = profile.bins;
  const slot = (COLUMN_PLOT_RIGHT - COLUMN_PLOT_LEFT) / Math.max(1, bins.length);
  const step = bins.length > 6 ? 2 : 1;
  const edges = [...bins.map((bin) => bin.from), bins[bins.length - 1]?.to ?? 0];
  const axisLabels = edges
    .map((edge, index) => ({ x: COLUMN_PLOT_LEFT + index * slot, label: formatNumber(edge), index }))
    .filter((item) => item.index % step === 0)
    .map(({ x, label }) => ({ x, label }));
  const bars = bins.map((bin) => ({
    label: `${formatNumber(bin.from)} to ${formatNumber(bin.to)}`,
    tooltip: `${formatNumber(bin.from)} to ${formatNumber(bin.to)}: ${formatCount(bin.count)} (${formatShare(bin.count, profile.answeredCount)})`,
    count: bin.count,
  }));
  return renderVerticalBars(chartId, `${profile.label}: distribution of values`, describeAnswered(profile), bars, axisLabels, true);
}

// Every month from the first answer to the last, with the months nobody answered in at zero.
export function fillMonths(months: PulseValueCount[]): PulseValueCount[] {
  if (months.length === 0) {
    return [];
  }

  const counts = new Map(months.map((month) => [month.value, month.count]));
  const sorted = [...counts.keys()].sort();
  const [firstYear, firstMonth] = sorted[0].split('-').map(Number);
  const [lastYear, lastMonth] = sorted[sorted.length - 1].split('-').map(Number);
  const filled: PulseValueCount[] = [];

  for (let index = firstYear * 12 + firstMonth - 1; index <= lastYear * 12 + lastMonth - 1; index += 1) {
    // Years are padded to match the profiled keys, so a mistyped year still finds its own count.
    const value = `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
    filled.push({ value, count: counts.get(value) ?? 0 });
  }

  return filled;
}

function groupByYear(months: PulseValueCount[]): PulseValueCount[] {
  const byYear = new Map<string, number>();

  months.forEach((month) => {
    const year = month.value.slice(0, 4);
    byYear.set(year, (byYear.get(year) ?? 0) + month.count);
  });

  return Array.from(byYear, ([value, count]) => ({ value, count }));
}

// Equal-width year ranges from the earliest year, so the axis stays in order.
function groupYears(years: PulseValueCount[], width: number): PulseValueCount[] {
  const buckets: PulseValueCount[] = [];

  for (let start = 0; start < years.length; start += width) {
    const span = years.slice(start, start + width);
    const last = span[span.length - 1].value;

    buckets.push({
      value: span[0].value === last ? last : `${span[0].value}–${last}`,
      count: span.reduce((sum, year) => sum + year.count, 0),
    });
  }

  return buckets;
}

/**
 * Months, then years, then year ranges — every rung capped, because a single mistyped year makes
 * the span itself unbounded and the date axis is the only one whose length comes from the values.
 */
export function bucketDates(months: PulseValueCount[]): { buckets: PulseValueCount[]; unit: DateUnit } {
  const filled = fillMonths(months);

  if (filled.length <= MAX_DATE_BARS) {
    return { buckets: filled, unit: 'month' };
  }

  const years = groupByYear(filled);

  if (years.length <= MAX_DATE_BARS) {
    return { buckets: years, unit: 'year' };
  }

  return { buckets: groupYears(years, Math.ceil(years.length / MAX_DATE_BARS)), unit: 'period' };
}

function renderMonthBars(profile: DateProfile, chartId: string): string {
  const { buckets, unit } = bucketDates(profile.months);
  const slot = (COLUMN_PLOT_RIGHT - COLUMN_PLOT_LEFT) / Math.max(1, buckets.length);
  const step = Math.ceil(buckets.length / MAX_AXIS_LABELS);
  const axisLabels = buckets
    .map((bucket, index) => ({ x: COLUMN_PLOT_LEFT + index * slot + slot / 2, label: bucket.value, index }))
    .filter((item) => item.index % step === 0)
    .map(({ x, label }) => ({ x, label }));
  const bars = buckets.map((bucket) => ({
    label: bucket.value,
    tooltip: `${bucket.value}: ${formatCount(bucket.count)} (${formatShare(bucket.count, profile.answeredCount)})`,
    count: bucket.count,
  }));
  const title = `${profile.label}: answers by ${DATE_UNIT_TITLES[unit]}`;

  return renderVerticalBars(chartId, title, describeAnswered(profile), bars, axisLabels, false);
}

export function renderColumnChart(profile: PulseColumnProfile, chartId: string): string | null {
  switch (profile.kind) {
    case 'categorical':
      return profile.counts.length === 0 && profile.fallbackCount === 0 ? null : renderCategoricalChart(profile, chartId);
    case 'numeric':
      return profile.bins.length === 0 ? null : renderHistogram(profile, chartId);
    case 'date':
      return profile.months.length === 0 ? null : renderMonthBars(profile, chartId);
    default:
      return null;
  }
}

function renderColumnDataTable(profile: PulseColumnProfile): string {
  switch (profile.kind) {
    case 'categorical': {
      const rows = profile.counts.map((item) => [item.value, formatCount(item.count), formatShare(item.count, profile.answeredCount)]);
      if (profile.source === 'tool' && profile.fallbackCount > 0) {
        rows.push([MATRIX_FALLBACK_VALUE, formatCount(profile.fallbackCount), `${formatShare(profile.fallbackCount, profile.rowCount)} of rows`]);
      }
      return renderDataTable(profile.label, ['Answer', 'Count', 'Share of answered'], rows);
    }
    case 'numeric':
      return renderDataTable(
        profile.label,
        ['Range', 'Count'],
        profile.bins.map((bin) => [`${formatNumber(bin.from)} to ${formatNumber(bin.to)}`, formatCount(bin.count)]),
      );
    case 'date': {
      const { buckets, unit } = bucketDates(profile.months);
      return renderDataTable(profile.label, [DATE_UNIT_HEADINGS[unit], 'Count'], buckets.map((bucket) => [bucket.value, formatCount(bucket.count)]));
    }
    default:
      return '';
  }
}

// A heading names what the chart shows rather than which column it is; the label moves below it.
export type ColumnFigureOptions = { note?: string; heading?: string };

export function renderColumnFigure(
  profile: PulseColumnProfile,
  chartId: string,
  { note, heading }: ColumnFigureOptions = {},
): string {
  const chart = renderColumnChart(profile, chartId);
  const noteHtml = note ? `<p class="note">${escapeHtml(note)}</p>` : '';
  const table = chart ? renderColumnDataTable(profile) : '';
  const answered = heading === undefined
    ? describeAnswered(profile)
    : `${profile.label} · ${describeAnswered(profile)}`;
  return [
    `<figure class="column" id="${escapeHtml(chartId)}-figure" data-column-key="${escapeHtml(profile.key)}">`,
    `<figcaption><h3>${escapeHtml(heading ?? profile.label)}</h3><p class="answered">${escapeHtml(answered)}</p></figcaption>`,
    `<p class="summary">${escapeHtml(summarizeProfile(profile))}</p>`,
    chart ?? '',
    noteHtml,
    table,
    '</figure>',
  ].join('');
}

type BreakdownSeries = {
  labels: string[];
  colors: string[];
  inks: string[];
  rows: Array<{ label: string; total: number; counts: number[] }>;
};

// Keeps the first seven values and folds the rest into Other once there are more than eight.
function foldBreakdown(breakdown: PulseBreakdown): BreakdownSeries {
  const fold = breakdown.values.length > MAX_BREAKDOWN_SERIES;
  const kept = fold ? MAX_BREAKDOWN_SERIES - 1 : breakdown.values.length;
  const foldCounts = (counts: number[]): number[] => (fold ? [...counts.slice(0, kept), sum(counts.slice(kept))] : counts);
  const labels = fold
    ? [...breakdown.values.slice(0, kept), otherBucketLabel(breakdown.values.length - kept)]
    : breakdown.values;
  const colors = labels.map((_, index) => (fold && index === kept ? PULSE_OTHER_COLOR : PULSE_SERIES_COLORS[index]));
  const inks = labels.map((_, index) => (fold && index === kept ? PULSE_OTHER_LABEL_INK : PULSE_SERIES_LABEL_INK[index]));
  const overall = foldCounts(breakdown.overall);

  return {
    labels,
    colors,
    inks,
    rows: [
      { label: 'All answers', total: sum(overall), counts: overall },
      ...breakdown.groups.map((group) => ({ label: group.group, total: group.total, counts: foldCounts(group.counts) })),
    ],
  };
}

function renderStackRow(series: BreakdownSeries, row: BreakdownSeries['rows'][number], index: number): string {
  const plotWidth = CHART_WIDTH - CATEGORY_LABEL_WIDTH - STACK_RIGHT_PADDING;
  const rowTop = CHART_TOP + index * BAR_ROW;
  const barY = rowTop + (BAR_ROW - BAR_THICKNESS) / 2;
  const middle = px(rowTop + BAR_ROW / 2);
  const rowLabel = `${row.label} (n=${formatCount(row.total)})`;
  const label = `<text class="category" x="${CATEGORY_LABEL_WIDTH - 8}" y="${middle}" text-anchor="end" dominant-baseline="middle">${escapeHtml(truncateLabel(rowLabel))}<title>${escapeHtml(rowLabel)}</title></text>`;
  const lastVisible = row.counts.reduce((last, count, countIndex) => (count > 0 ? countIndex : last), -1);

  let x = CATEGORY_LABEL_WIDTH;
  const segments = row.counts.map((count, countIndex) => {
    if (count <= 0 || row.total <= 0) {
      return '';
    }
    const fullWidth = (count / row.total) * plotWidth;
    const drawnWidth = countIndex === lastVisible ? fullWidth : Math.max(0, fullWidth - SURFACE_GAP);
    const segmentX = x;
    x += fullWidth;
    const share = formatShare(count, row.total);
    const tooltip = escapeHtml(`${row.label}: ${series.labels[countIndex]} ${formatCount(count)} of ${formatCount(row.total)} (${share})`);
    const shape = countIndex === lastVisible
      ? `<path d="${horizontalBarPath(segmentX, barY, drawnWidth, BAR_THICKNESS)}" fill="${series.colors[countIndex]}"><title>${tooltip}</title></path>`
      : `<rect x="${px(segmentX)}" y="${px(barY)}" width="${px(drawnWidth)}" height="${BAR_THICKNESS}" fill="${series.colors[countIndex]}"><title>${tooltip}</title></rect>`;
    const inside = drawnWidth >= MIN_INSIDE_LABEL_WIDTH
      ? `<text x="${px(segmentX + drawnWidth / 2)}" y="${middle}" text-anchor="middle" dominant-baseline="middle" style="fill:${series.inks[countIndex]};font-size:11px">${share}</text>`
      : '';
    return `${shape}${inside}`;
  });

  return `<g class="stack-row">${label}${segments.join('')}</g>`;
}

export function renderBreakdownFigure(breakdown: PulseBreakdown, rowCount: number, chartId: string): string {
  const series = foldBreakdown(breakdown);
  const title = `${breakdown.toolLabel} by ${breakdown.groupLabel}`;
  const answered = `Answered by ${formatCount(series.rows[0].total)} of ${formatCount(rowCount)}`;
  const height = CHART_TOP * 2 + series.rows.length * BAR_ROW;
  const legend = `<ul class="legend">${series.labels
    .map((label, index) => `<li class="legend-item"><span class="swatch" style="background:${series.colors[index]}"></span>${escapeHtml(label)}</li>`)
    .join('')}</ul>`;
  const svg = `${openSvg(chartId, height, `${title}: share of each value per group`, answered)}${series.rows.map((row, index) => renderStackRow(series, row, index)).join('')}</svg>`;
  const table = renderDataTable(
    title,
    [breakdown.groupLabel, ...series.labels, 'Total'],
    series.rows.map((row) => [row.label, ...row.counts.map((count) => formatCount(count)), formatCount(row.total)]),
  );

  return [
    `<figure class="breakdown" id="${escapeHtml(chartId)}-figure" data-breakdown-key="${escapeHtml(`${breakdown.toolKey}|${breakdown.groupKey}`)}">`,
    `<figcaption><h3>${escapeHtml(title)}</h3><p class="answered">${escapeHtml(answered)}</p></figcaption>`,
    `<p class="summary">${escapeHtml(summarizeBreakdown(breakdown))}</p>`,
    legend,
    svg,
    table,
    '</figure>',
  ].join('');
}
