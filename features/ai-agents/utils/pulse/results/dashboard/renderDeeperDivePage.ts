import type { PulseReportInput } from '@/features/ai-agents/types/pulse/results';
import {
  buildMethodNotes,
  formatCount,
  renderBreakdownFigure,
  renderColumnFigure,
} from '@/features/ai-agents/utils/pulse/results/charts';
import {
  OVERVIEW_CHART_COUNT,
  breakdownRowCount,
  groupBreakdowns,
  selectDashboardCharts,
  type BreakdownGroup,
} from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardData';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';

export const NO_GROUPS_MESSAGE = 'This survey had no columns suited to comparing groups of respondents.';

function renderSelector(groups: BreakdownGroup[]): string {
  if (groups.length === 1) {
    return `<p class="meta" data-group-label>Compared by ${escapeHtml(groups[0].label)}</p>`;
  }

  const options = groups
    .map((group, index) => `<button type="button" role="radio" class="option" data-group-option="${index}" aria-controls="deeper/${index}" aria-checked="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${escapeHtml(group.label)}</button>`)
    .join('');

  return [
    `<div class="selector" data-group-selector><span class="selector-label" id="group-selector-label">Compare by</span><div class="options" role="radiogroup" aria-labelledby="group-selector-label">${options}</div></div>`,
    `<p class="meta showing" data-group-showing aria-live="polite">Showing: by <span data-group-showing-label>${escapeHtml(groups[0].label)}</span></p>`,
  ].join('');
}

function renderGroupPanel(input: PulseReportInput, group: BreakdownGroup, index: number): string {
  const rowCount = breakdownRowCount(input);
  const figures = group.breakdowns
    .map((breakdown, position) => renderBreakdownFigure(breakdown, rowCount, `group-${index}-${position}`))
    .join('');

  return `<div class="group-panel" id="deeper/${index}" data-group="${index}"><h3 class="group-heading">By ${escapeHtml(group.label)}</h3>${figures}</div>`;
}

function renderComparisons(input: PulseReportInput): string {
  const groups = groupBreakdowns(input.profile.breakdowns);

  if (groups.length === 0) {
    return `<section data-part="comparisons"><h2>Compare groups</h2><p class="muted" data-part="no-groups">${NO_GROUPS_MESSAGE}</p></section>`;
  }

  const panels = groups.map((group, index) => renderGroupPanel(input, group, index)).join('');

  return `<section data-part="comparisons"><h2>Compare groups</h2>${renderSelector(groups)}${panels}</section>`;
}

function renderMoreCharts(input: PulseReportInput): string {
  const figures = selectDashboardCharts(input)
    .slice(OVERVIEW_CHART_COUNT)
    .map(({ column, chartId, heading }) => renderColumnFigure(column, chartId, { heading }))
    .join('');

  return figures ? `<section data-part="more-charts"><h2>More charts</h2><div class="figure-grid">${figures}</div></section>` : '';
}

function renderAllQuestions(input: PulseReportInput): string {
  const { profile, narrative } = input;

  if (profile.columns.length === 0) {
    return '';
  }

  const figures = profile.columns
    .map((column, index) => renderColumnFigure(column, `column-${index}`, { note: narrative?.columnNotes[column.label] }))
    .join('');
  const summary = escapeHtml(`All questions (${formatCount(profile.columns.length)})`);

  return `<details class="appendix" data-part="all-questions"><summary>${summary}</summary><div class="figure-grid">${figures}</div></details>`;
}

function renderMethod(input: PulseReportInput): string {
  const notes = buildMethodNotes(input).map((note) => `<li>${escapeHtml(note)}</li>`).join('');

  return `<details class="appendix" data-part="method"><summary>Method and caveats</summary><ul class="method">${notes}</ul></details>`;
}

export default function renderDeeperDivePage(input: PulseReportInput): string {
  return [
    renderComparisons(input),
    renderMoreCharts(input),
    renderAllQuestions(input),
    renderMethod(input),
  ].join('');
}
