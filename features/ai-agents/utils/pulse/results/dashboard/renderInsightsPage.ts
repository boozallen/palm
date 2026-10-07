import type {
  PulseColumnProfile,
  PulseNarrative,
  PulseReportInput,
} from '@/features/ai-agents/types/pulse/results';
import { renderColumnFigure } from '@/features/ai-agents/utils/pulse/results/charts';
import {
  indexColumns,
  isChartable,
} from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardData';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';
import {
  quotesByIds,
  renderQuote,
} from '@/features/ai-agents/utils/pulse/results/renderResultsDashboard';

export const TOPICS_MISSING_MESSAGE = 'Topics come from the written summary, which couldn\'t be generated for this run.';

type Finding = PulseNarrative['keyFindings'][number];
type Action = PulseNarrative['recommendedActions'][number];

function renderAction(item: Action): string {
  return `<li><strong>${escapeHtml(item.action)}</strong>${escapeHtml(item.rationale)}</li>`;
}

function renderChips(narrative: PulseNarrative): string {
  const chips = narrative.keyFindings
    .map((finding, index) => {
      const topic = index + 1;
      return `<button type="button" role="radio" class="option" data-topic-option="${topic}" aria-controls="insights/${topic}" aria-checked="${topic === 1}" tabindex="${topic === 1 ? 0 : -1}">${escapeHtml(finding.title)}</button>`;
    })
    .join('');

  return `<div class="selector" data-topic-selector><span class="selector-label" id="topic-selector-label">Topic</span><div class="options" role="radiogroup" aria-labelledby="topic-selector-label">${chips}</div></div>`;
}

function renderTopicCharts(input: PulseReportInput, finding: Finding, topic: number): string {
  const byLabel = indexColumns(input);
  const figures = finding.columns
    .map((label) => byLabel.get(label)?.column)
    .filter((column): column is PulseColumnProfile => column !== undefined && isChartable(column))
    .map((column, position) => renderColumnFigure(column, `topic-${topic}-${position}`))
    .join('');

  return figures ? `<div class="figure-grid" data-part="charts">${figures}</div>` : '';
}

function renderTopicPanel(input: PulseReportInput, narrative: PulseNarrative, finding: Finding, topic: number): string {
  const quotes = quotesByIds(input, finding.quoteIds).map(renderQuote).join('');
  const actions = narrative.recommendedActions.filter((item) => item.finding === topic).map(renderAction).join('');

  return [
    `<article class="topic-panel" id="insights/${topic}" data-topic="${topic}">`,
    `<h2 data-part="insight">${escapeHtml(finding.title)}</h2>`,
    `<p data-part="evidence">${escapeHtml(finding.detail)}</p>`,
    finding.whyItMatters ? `<section data-part="why"><h3>Why it matters</h3><p>${escapeHtml(finding.whyItMatters)}</p></section>` : '',
    renderTopicCharts(input, finding, topic),
    quotes ? `<section data-part="quotes"><h3>In respondents' words</h3>${quotes}</section>` : '',
    finding.caveat ? `<p class="caveat" data-part="caveat"><strong>Read with care: </strong>${escapeHtml(finding.caveat)}</p>` : '',
    actions ? `<section data-part="actions"><h3>What to do</h3><ol class="actions">${actions}</ol></section>` : '',
    '</article>',
  ].join('');
}

function renderAllActions(narrative: PulseNarrative): string {
  const items = narrative.recommendedActions.map(renderAction).join('');

  return `<section data-part="all-actions"><h2>All recommended actions</h2><ol class="actions">${items}</ol></section>`;
}

export default function renderInsightsPage(input: PulseReportInput): string {
  const { narrative } = input;

  if (!narrative) {
    return `<p class="muted" data-part="topics-missing">${escapeHtml(TOPICS_MISSING_MESSAGE)}</p>`;
  }

  const panels = narrative.keyFindings
    .map((finding, index) => renderTopicPanel(input, narrative, finding, index + 1))
    .join('');

  return [renderChips(narrative), panels, renderAllActions(narrative)].join('');
}
