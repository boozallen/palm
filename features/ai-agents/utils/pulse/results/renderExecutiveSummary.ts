import type {
  PulseColumnProfile,
  PulseNarrative,
  PulseReportInput,
} from '@/features/ai-agents/types/pulse/results';
import {
  NARRATIVE_MISSING_BANNER,
  buildMethodNotes,
  describeAnswered,
  formatCount,
  formatRunDate,
  renderColumnChart,
  renderColumnFigure,
  renderHtmlDocument,
  summarizeBreakdown,
  summarizeProfile,
} from '@/features/ai-agents/utils/pulse/results/charts';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';
import {
  findingTitleFor,
  renderQuote,
  selectQuotes,
} from '@/features/ai-agents/utils/pulse/results/renderResultsDashboard';
import { PULSE_BASE_CSS, PULSE_OUTPUT_COLORS } from '@/features/ai-agents/utils/pulse/results/theme';

/**
 * The page budget. A leadership briefing is a page and a half, so the summary carries the top of
 * every list and points at the dashboard for the rest; the caps are what keep it to that length.
 */
export const MAX_SUMMARY_FINDINGS = 3;
export const MAX_SUMMARY_ACTIONS = 3;
export const MAX_SUMMARY_CHARTS = 2;
const MAX_SUMMARY_SUPPORT = 1;
const MAX_SUMMARY_QUOTES = 1;

const SUMMARY_CSS = `${PULSE_BASE_CSS}
@page { size: Letter; margin: 0.6in 0.7in; }
body { font-size: 12.5px; line-height: 1.45; }
main { max-width: 7.1in; margin: 0 auto; padding: 24px 0; }
@media print { main { padding: 0; } }
.eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; color: ${PULSE_OUTPUT_COLORS.inkMuted}; margin: 0 0 4px; }
h1 { font-size: 22px; }
h2 { font-size: 15px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid ${PULSE_OUTPUT_COLORS.grid}; }
.headline { font-size: 17px; margin: 14px 0 6px; }
.lead { font-size: 14px; margin: 0 0 12px; }
.findings li, .actions li { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
.findings strong, .actions strong { display: block; }
.support { list-style: none; padding: 0; margin: 4px 0 0; color: ${PULSE_OUTPUT_COLORS.inkSecondary}; font-size: 11.5px; }
.support li { margin: 0 0 2px; }
.numbers td, .numbers th { font-size: 11.5px; padding: 3px 10px 3px 0; }
figure.column { padding: 12px; margin: 0 0 12px; }
figure.column svg.chart { max-width: 5.4in; }
figure.column .summary { font-size: 12px; margin: 4px 0 6px; }
figure.column .note { font-size: 11.5px; margin: 6px 0 0; }
blockquote.quote { font-size: 12px; }
.method-note { color: ${PULSE_OUTPUT_COLORS.inkMuted}; font-size: 11px; margin-top: 16px; }
`;

function renderHeader(input: PulseReportInput): string {
  return `<header data-section="header"><p class="eyebrow">Executive summary</p><h1>${escapeHtml(input.facts.surveyFilename)}</h1></header>`;
}

/**
 * What a leader needs before deciding whether to read on: the single most important result, then
 * the single most important thing to do about it. Both are already written; neither is new.
 */
function renderOpening(narrative: PulseNarrative): string {
  const lead = narrative.recommendedActions
    .slice(0, 1)
    .map((item) => `<p class="lead" data-section="lead"><strong>What to do:</strong> ${escapeHtml(item.action)}</p>`)
    .join('');

  return `<p class="headline" data-section="headline">${escapeHtml(narrative.headline)}</p>${lead}`;
}

function renderSupport(labels: string[], byLabel: Map<string, PulseColumnProfile>): string {
  const lines = labels
    .map((label) => byLabel.get(label))
    .filter((column): column is PulseColumnProfile => column !== undefined)
    .slice(0, MAX_SUMMARY_SUPPORT)
    .map((column) => `<li>${escapeHtml(`${column.label}: ${summarizeProfile(column)} ${describeAnswered(column)}.`)}</li>`);
  return lines.length > 0 ? `<ul class="support">${lines.join('')}</ul>` : '';
}

/**
 * The two charts that carry the message, from the columns the narrative featured and in its order.
 * Each is titled by the finding it supports, so the reader is told the conclusion rather than
 * left to work it out. A featured column with nothing to plot is skipped.
 */
function renderCharts(input: PulseReportInput, narrative: PulseNarrative): string {
  const byLabel = new Map(input.profile.columns.map((column) => [column.label, column]));
  const figures = narrative.featuredColumns
    .map((label) => byLabel.get(label))
    .filter((column): column is PulseColumnProfile => column !== undefined && renderColumnChart(column, 'probe') !== null)
    .slice(0, MAX_SUMMARY_CHARTS)
    .map((column, position) => renderColumnFigure(column, `summary-chart-${position}`, {
      heading: findingTitleFor(column.label, narrative),
      note: narrative.columnNotes[column.label],
    }))
    .join('');

  return figures.length > 0
    ? `<section data-section="charts"><h2>Supporting evidence</h2>${figures}</section>`
    : '';
}

function renderNarrativeBody(input: PulseReportInput, narrative: PulseNarrative): string {
  const byLabel = new Map(input.profile.columns.map((column) => [column.label, column]));
  const findings = narrative.keyFindings
    .slice(0, MAX_SUMMARY_FINDINGS)
    .map((finding) => `<li><strong>${escapeHtml(finding.title)}</strong>${escapeHtml(finding.detail)}${renderSupport(finding.columns, byLabel)}</li>`)
    .join('');
  const actions = narrative.recommendedActions
    .slice(0, MAX_SUMMARY_ACTIONS)
    .map((item) => `<li><strong>${escapeHtml(item.action)}</strong>${escapeHtml(item.rationale)}</li>`)
    .join('');

  return [
    renderOpening(narrative),
    `<section data-section="findings"><h2>Key findings</h2><ol class="findings">${findings}</ol></section>`,
    renderCharts(input, narrative),
    `<section data-section="actions"><h2>Recommended actions</h2><ol class="actions">${actions}</ol></section>`,
  ].join('');
}

function renderNumbersBody(input: PulseReportInput): string {
  const { facts, profile } = input;
  const rows = profile.columns
    .map((column) => `<tr><td>${escapeHtml(column.label)}</td><td>${escapeHtml(summarizeProfile(column))}</td><td>${escapeHtml(describeAnswered(column))}</td></tr>`)
    .join('');
  const table = `<table class="numbers"><thead><tr><th scope="col">Column</th><th scope="col">Result</th><th scope="col">Answered</th></tr></thead><tbody>${rows}</tbody></table>`;
  const breakdowns = profile.breakdowns.length > 0
    ? `<section data-section="breakdowns"><h2>Breakdowns</h2><ul class="support">${profile.breakdowns
      .map((breakdown) => `<li>${escapeHtml(summarizeBreakdown(breakdown))}</li>`)
      .join('')}</ul></section>`
    : '';
  const rowCount = facts.rowsAnalyzed + facts.failedRowCount;
  return [
    `<div class="banner" role="note" data-section="banner">${NARRATIVE_MISSING_BANNER}</div>`,
    `<section data-section="columns"><h2>Every column (${escapeHtml(formatCount(rowCount))} rows)</h2>${table}</section>`,
    breakdowns,
  ].join('');
}

function renderQuotes(input: PulseReportInput): string {
  const quotes = selectQuotes(input, MAX_SUMMARY_QUOTES);
  if (quotes.length === 0) {
    return '';
  }
  return `<section data-section="quotes"><h2>In their words</h2>${quotes.map(renderQuote).join('')}</section>`;
}

// What this page left out, so the reader knows it is a selection rather than everything found.
function describeRemainder(narrative: PulseNarrative | null): string {
  if (!narrative) {
    return '';
  }

  const left = Math.max(narrative.keyFindings.length - MAX_SUMMARY_FINDINGS, 0)
    + Math.max(narrative.recommendedActions.length - MAX_SUMMARY_ACTIONS, 0);

  return left > 0
    ? `${formatCount(left)} further findings and actions, and every column, are in the results dashboard.`
    : 'Every column is in the results dashboard.';
}

/**
 * The run's provenance at the foot rather than the head: rows and model are what a reader checks
 * after the findings have landed, and leading with them buries the message.
 */
function renderMethodNote(input: PulseReportInput): string {
  const { facts } = input;
  const notes = buildMethodNotes(input);
  const line = [
    `Run ${formatRunDate(facts.completedAt)}`,
    `${formatCount(facts.rowsAnalyzed)} of ${formatCount(facts.rowsInFile)} rows analyzed`,
    facts.modelName,
  ].join(' · ');

  return `<p class="method-note" data-section="method">${escapeHtml(`${line}. ${notes[0]} ${notes[notes.length - 1]} ${describeRemainder(input.narrative)}`.trim())}</p>`;
}

export default function renderExecutiveSummary(input: PulseReportInput): string {
  const { narrative } = input;
  const body = [
    '<main>',
    renderHeader(input),
    narrative ? renderNarrativeBody(input, narrative) : renderNumbersBody(input),
    renderQuotes(input),
    renderMethodNote(input),
    '</main>',
  ].join('\n');

  return renderHtmlDocument(`Executive summary: ${input.facts.surveyFilename}`, SUMMARY_CSS, body);
}
