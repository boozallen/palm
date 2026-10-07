import type {
  PulseColumnProfile,
  PulseFindingTone,
  PulseNarrative,
  PulseReportInput,
} from '@/features/ai-agents/types/pulse/results';
import { isOtherBucket } from '@/features/ai-agents/utils/pulse/selectChartableDistributions';
import {
  NARRATIVE_MISSING_BANNER,
  formatCount,
  formatShare,
  renderColumnFigure,
} from '@/features/ai-agents/utils/pulse/results/charts';
import {
  OVERVIEW_CHART_COUNT,
  indexColumns,
  selectDashboardCharts,
} from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardData';
import { selectFeatured } from '@/features/ai-agents/utils/pulse/results/renderResultsDashboard';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';

const TONE_LISTS: Array<{ tone: PulseFindingTone; heading: string }> = [
  { tone: 'positive', heading: 'Going well' },
  { tone: 'concern', heading: 'Needs attention' },
];

function renderKpi(kind: string, value: string, label: string): string {
  return `<div class="kpi" data-kpi="${kind}"><span class="kpi-value">${escapeHtml(value)}</span><span class="kpi-label">${escapeHtml(label)}</span></div>`;
}

function renderTopAnswer(column: PulseColumnProfile | undefined): string {
  if (column?.kind !== 'categorical') {
    return '';
  }

  const top = column.counts
    .filter((entry) => !isOtherBucket(entry.value))
    .reduce<typeof column.counts[number] | null>((best, entry) => (best === null || entry.count > best.count ? entry : best), null);

  if (top === null || top.count === 0) {
    return '';
  }

  return renderKpi('top-answer', formatShare(top.count, column.answeredCount), `${top.value} · ${column.label}`);
}

function renderToneLists(narrative: PulseNarrative): string {
  const lists = TONE_LISTS.map(({ tone, heading }) => {
    const items = narrative.keyFindings
      .map((finding, index) => ({ finding, topic: index + 1 }))
      .filter(({ finding }) => finding.tone === tone)
      .map(({ finding, topic }) => `<li><a href="#insights/${topic}" data-topic-link="${topic}">${escapeHtml(finding.title)}</a></li>`);

    return items.length === 0
      ? ''
      : `<section class="tone-list tone-${tone}" data-tone-list="${tone}"><h2>${heading}</h2><ul>${items.join('')}</ul></section>`;
  }).filter(Boolean);

  return lists.length === 0 ? '' : `<div class="tone-lists">${lists.join('')}</div>`;
}

export default function renderOverviewPage(input: PulseReportInput): string {
  const { facts, narrative } = input;
  const charts = selectDashboardCharts(input).slice(0, OVERVIEW_CHART_COUNT);
  const lead = narrative
    ? `<p class="headline" data-part="headline">${escapeHtml(narrative.headline)}</p>`
    : `<div class="banner" role="note" data-part="banner">${NARRATIVE_MISSING_BANNER}</div>`;
  const kpis = [
    renderKpi('respondents', formatCount(facts.rowsInFile), 'Respondents'),
    renderKpi('analyzed', formatCount(facts.rowsAnalyzed), 'Rows analyzed'),
    renderTopAnswer(narrative ? selectFeatured(narrative, indexColumns(input))[0]?.column : undefined),
  ].join('');
  const figures = charts
    .map(({ column, chartId, heading }) => renderColumnFigure(column, chartId, { heading }))
    .join('');

  return [
    lead,
    `<div class="kpis" data-part="kpis">${kpis}</div>`,
    narrative ? renderToneLists(narrative) : '',
    figures ? `<div class="figure-grid" data-part="charts">${figures}</div>` : '',
  ].join('');
}
