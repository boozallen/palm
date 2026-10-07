import type {
  PulseColumnProfile,
  PulseNarrative,
  PulseQuote,
  PulseReportInput,
} from '@/features/ai-agents/types/pulse/results';
import {
  NARRATIVE_MISSING_BANNER,
  buildMethodNotes,
  formatCount,
  formatRunDate,
  renderBreakdownFigure,
  renderColumnFigure,
  renderHtmlDocument,
} from '@/features/ai-agents/utils/pulse/results/charts';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';
import { PULSE_BASE_CSS } from '@/features/ai-agents/utils/pulse/results/theme';

const MAX_UNSELECTED_QUOTES = 6;

const DASHBOARD_CSS = `${PULSE_BASE_CSS}
main { max-width: 1120px; margin: 0 auto; padding: 32px 24px 64px; }
section { margin-top: 24px; }
.findings strong { display: block; }
nav.sections ul { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 16px; padding: 0; margin: 12px 0 0; }
details.appendix > summary { cursor: pointer; margin-bottom: 12px; }
@media print {
  details.appendix > summary { display: none; }
  details.appendix > *:not(summary) { display: block; }
}
`;

export type IndexedColumn = { column: PulseColumnProfile; index: number };

// One per rendered section, so the nav offers only what the page actually contains.
type DashboardSection = { id: string; navLabel: string; html: string };

export type FeaturedColumn = { column: PulseColumnProfile; chartId: string; heading: string | undefined };

function columnAnchor(index: number): string {
  return `column-${index}`;
}

function renderHeader(input: PulseReportInput): string {
  const { facts } = input;
  const meta = [
    `Run ${formatRunDate(facts.completedAt)}`,
    `${formatCount(facts.rowsAnalyzed)} of ${formatCount(facts.rowsInFile)} rows analyzed`,
    facts.modelName,
  ].map((part) => escapeHtml(part)).join(' · ');
  return `<header data-section="header"><h1>Results: ${escapeHtml(facts.surveyFilename)}</h1><p class="meta">${meta}</p></header>`;
}

function renderNav(sections: DashboardSection[]): string {
  const links = sections
    .map(({ id, navLabel }) => `<li><a href="#${id}">${escapeHtml(navLabel)}</a></li>`)
    .join('');
  return `<nav class="sections meta" data-section="nav" aria-label="Jump to a section"><ul>${links}</ul></nav>`;
}

function renderParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

// The first finding a column supports, so a featured chart's heading says why it is featured.
export function findingTitleFor(label: string, narrative: PulseNarrative): string | undefined {
  return narrative.keyFindings.find((finding) => finding.columns.includes(label))?.title;
}

export function selectFeatured(narrative: PulseNarrative, byLabel: Map<string, IndexedColumn>): FeaturedColumn[] {
  return narrative.featuredColumns
    .map((label) => byLabel.get(label))
    .filter((entry): entry is IndexedColumn => entry !== undefined)
    .map((entry, position) => ({
      column: entry.column,
      chartId: `featured-${position}`,
      heading: findingTitleFor(entry.column.label, narrative),
    }));
}

/**
 * The featured copy of a chart in preference to the appendix copy: the appendix is collapsed, so
 * a link into it depends on the browser opening it, while the featured grid is always visible.
 */
function columnFigureAnchor(
  label: string,
  byLabel: Map<string, IndexedColumn>,
  featuredAnchors: Map<string, string>,
): string | null {
  const featured = featuredAnchors.get(label);

  if (featured !== undefined) {
    return featured;
  }

  const entry = byLabel.get(label);

  return entry === undefined ? null : `${columnAnchor(entry.index)}-figure`;
}

function renderColumnLink(
  label: string,
  byLabel: Map<string, IndexedColumn>,
  featuredAnchors: Map<string, string>,
): string {
  const anchor = columnFigureAnchor(label, byLabel, featuredAnchors);

  return anchor === null ? escapeHtml(label) : `<a href="#${anchor}">${escapeHtml(label)}</a>`;
}

function renderSummarySection(narrative: PulseNarrative): DashboardSection {
  return {
    id: 'summary',
    navLabel: 'Summary',
    html: `<section data-section="summary" id="summary"><p class="headline">${escapeHtml(narrative.headline)}</p>${renderParagraphs(narrative.overview)}</section>`,
  };
}

function renderFindingsSection(
  input: PulseReportInput,
  narrative: PulseNarrative,
  byLabel: Map<string, IndexedColumn>,
  featuredAnchors: Map<string, string>,
): DashboardSection {
  const findings = narrative.keyFindings.map((finding) => {
    const cited = finding.columns.length > 0
      ? `<div class="cited">Columns: ${finding.columns.map((label) => renderColumnLink(label, byLabel, featuredAnchors)).join(', ')}</div>`
      : '';
    const quotes = quotesByIds(input, finding.quoteIds).map(renderQuote).join('');
    return `<li><strong>${escapeHtml(finding.title)}</strong>${escapeHtml(finding.detail)}${cited}${quotes}</li>`;
  });

  return {
    id: 'findings',
    navLabel: 'Key findings',
    html: `<section data-section="findings" id="findings"><h2>Key findings</h2><ol class="findings">${findings.join('')}</ol></section>`,
  };
}

// The same actions the executive summary and the slides carry, in the same order.
function renderActionsSection(narrative: PulseNarrative): DashboardSection {
  const items = narrative.recommendedActions
    .map((item) => `<li><strong>${escapeHtml(item.action)}</strong>${escapeHtml(item.rationale)}</li>`)
    .join('');

  return {
    id: 'actions',
    navLabel: 'Recommended actions',
    html: `<section data-section="actions" id="actions"><h2>Recommended actions</h2><ol class="actions">${items}</ol></section>`,
  };
}

function renderFeaturedSection(featured: FeaturedColumn[]): DashboardSection | null {
  if (featured.length === 0) {
    return null;
  }

  const figures = featured
    .map(({ column, chartId, heading }) => `<div data-featured-key="${escapeHtml(column.key)}">${renderColumnFigure(column, chartId, { heading })}</div>`)
    .join('');

  return {
    id: 'featured',
    navLabel: 'Featured columns',
    html: `<section data-section="featured" id="featured"><h2>Featured columns</h2><div class="figure-grid">${figures}</div></section>`,
  };
}

function renderColumnsSection(input: PulseReportInput): DashboardSection {
  const { profile, narrative } = input;
  const surveyCount = profile.columns.filter((column) => column.source === 'survey').length;
  const toolCount = profile.columns.length - surveyCount;
  const figures = profile.columns
    .map((column, index) => renderColumnFigure(column, columnAnchor(index), { note: narrative?.columnNotes[column.label] }))
    .join('');
  const counts = escapeHtml(`${formatCount(surveyCount)} survey columns and ${formatCount(toolCount)} tool columns.`);
  // Collapsed so the page opens on the findings rather than on every chart at once.
  const appendix = profile.columns.length > 0
    ? `<details class="appendix"><summary>${escapeHtml(`Show all ${formatCount(profile.columns.length)} column charts`)}</summary><div class="figure-grid">${figures}</div></details>`
    : '';

  return {
    id: 'columns',
    navLabel: 'Every column',
    html: `<section data-section="columns" id="columns"><h2>Every column</h2><p class="meta">${counts}</p>${appendix}</section>`,
  };
}

function renderBreakdownsSection(input: PulseReportInput): DashboardSection {
  const { facts, profile } = input;
  const rowCount = facts.rowsAnalyzed + facts.failedRowCount;
  const body = profile.breakdowns.length > 0
    ? profile.breakdowns.map((breakdown, index) => renderBreakdownFigure(breakdown, rowCount, `breakdown-${index}`)).join('')
    : '<p class="muted">No tool column and survey column pair had enough categorical answers to compare.</p>';

  return {
    id: 'breakdowns',
    navLabel: 'Breakdowns',
    html: `<section data-section="breakdowns" id="breakdowns"><h2>Breakdowns</h2>${body}</section>`,
  };
}

// The sampled quotes behind a list of ids, in the order the ids were given; unknown ids drop out.
export function quotesByIds(input: PulseReportInput, ids: string[]): PulseQuote[] {
  const byId = new Map(input.profile.quotes.map((quote) => [quote.id, quote]));
  return ids
    .map((id) => byId.get(id))
    .filter((quote): quote is PulseQuote => quote !== undefined);
}

export function selectQuotes(input: PulseReportInput, limit: number): PulseQuote[] {
  const { profile, narrative } = input;
  if (!narrative) {
    return profile.quotes.slice(0, limit);
  }
  return quotesByIds(input, narrative.quoteIds).slice(0, limit);
}

export function renderQuote(quote: PulseQuote): string {
  return `<blockquote class="quote"><p>${escapeHtml(quote.text)}</p><footer>${escapeHtml(`${quote.columnLabel} · row ${quote.rowNumber}`)}</footer></blockquote>`;
}

function renderQuotesSection(input: PulseReportInput): DashboardSection | null {
  const quotes = selectQuotes(input, MAX_UNSELECTED_QUOTES);
  if (quotes.length === 0) {
    return null;
  }
  const heading = input.narrative ? 'Selected quotes' : 'Sample responses';

  return {
    id: 'quotes',
    navLabel: heading,
    html: `<section data-section="quotes" id="quotes"><h2>${heading}</h2>${quotes.map(renderQuote).join('')}</section>`,
  };
}

function renderMethodSection(input: PulseReportInput): DashboardSection {
  const notes = buildMethodNotes(input).map((note) => `<li>${escapeHtml(note)}</li>`).join('');

  return {
    id: 'method',
    navLabel: 'Method',
    html: `<section data-section="method" id="method"><h2>Method and caveats</h2><ul class="method">${notes}</ul></section>`,
  };
}

export default function renderResultsDashboard(input: PulseReportInput): string {
  const { narrative } = input;
  const byLabel = new Map<string, IndexedColumn>(
    input.profile.columns.map((column, index) => [column.label, { column, index }]),
  );
  const featured = narrative ? selectFeatured(narrative, byLabel) : [];
  const featuredAnchors = new Map(featured.map(({ column, chartId }) => [column.label, `${chartId}-figure`]));
  const narrativeSections = narrative
    ? [
      renderSummarySection(narrative),
      renderFindingsSection(input, narrative, byLabel, featuredAnchors),
      renderActionsSection(narrative),
    ]
    : [];
  const sections = [
    ...narrativeSections,
    renderFeaturedSection(featured),
    renderColumnsSection(input),
    renderBreakdownsSection(input),
    renderQuotesSection(input),
    renderMethodSection(input),
  ].filter((section): section is DashboardSection => section !== null);
  const banner = narrative
    ? ''
    : `<div class="banner" role="note" data-section="banner">${NARRATIVE_MISSING_BANNER}</div>`;

  const body = [
    '<main>',
    renderHeader(input),
    renderNav(sections),
    banner,
    ...sections.map((section) => section.html),
    '</main>',
  ].join('\n');

  return renderHtmlDocument(`PULSE results: ${input.facts.surveyFilename}`, DASHBOARD_CSS, body);
}
