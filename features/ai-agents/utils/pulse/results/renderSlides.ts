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
  renderHtmlDocument,
  summarizeBreakdown,
  summarizeProfile,
} from '@/features/ai-agents/utils/pulse/results/charts';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';
import { quotesByIds, renderQuote, selectQuotes } from '@/features/ai-agents/utils/pulse/results/renderResultsDashboard';
import { PULSE_BASE_CSS, PULSE_OUTPUT_COLORS } from '@/features/ai-agents/utils/pulse/results/theme';

export const MAX_FALLBACK_COLUMN_SLIDES = 6;
export const MAX_APPENDIX_SLIDES = 8;

export const ACTIONS_MISSING_MESSAGE = 'Recommended actions weren\'t generated. See the results dashboard for the numbers.';

const MAX_SLIDE_QUOTES = 2;
const MAX_QUOTE_POOL = 6;

// Plain ES5 so it runs in any browser; the deck stays fully readable if it never runs.
export const SLIDE_NAV_SCRIPT = `
(function () {
  var deck = document.querySelector('.deck');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var counter = document.querySelector('[data-slide-counter]');
  if (!deck || slides.length === 0) { return; }
  var index = 0;
  function show(next) {
    index = Math.max(0, Math.min(slides.length - 1, next));
    slides.forEach(function (slide, position) {
      slide.classList.toggle('is-active', position === index);
      slide.setAttribute('aria-hidden', position === index ? 'false' : 'true');
    });
    if (counter) { counter.textContent = (index + 1) + ' / ' + slides.length; }
  }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ' || event.key === 'PageDown') {
      event.preventDefault();
      show(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      show(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      show(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      show(slides.length - 1);
    }
  });
  deck.addEventListener('click', function (event) {
    var target = event.target;
    if (target && target.closest && target.closest('a, details, summary')) { return; }
    show(event.clientX < window.innerWidth / 3 ? index - 1 : index + 1);
  });
  deck.classList.add('is-enhanced');
  show(0);
})();
`;

const C = PULSE_OUTPUT_COLORS;

const SLIDES_CSS = `${PULSE_BASE_CSS}
@page { size: 13.333in 7.5in; margin: 0; }
html, body { height: 100%; }
body { font-size: 20px; background: ${C.grid}; }
.deck { min-height: 100%; }
.slide {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  padding: 6vh 7vw;
  background: ${C.page};
  border-bottom: 1px solid ${C.border};
}
.deck.is-enhanced .slide { display: none; border-bottom: 0; }
.deck.is-enhanced .slide.is-active { display: flex; }
.slide h1 { font-size: 44px; margin-bottom: 16px; }
.slide h2 { font-size: 32px; margin: 0 0 12px; }
.slide .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 14px; color: ${C.inkMuted}; margin: 0 0 8px; }
.slide .meta { font-size: 18px; }
.slide .headline { font-size: 34px; line-height: 1.3; margin: 0 0 20px; }
.slide .detail { font-size: 22px; color: ${C.inkSecondary}; max-width: 60em; }
.slide .answered { font-size: 15px; }
.slide .summary { font-size: 18px; }
.slide svg.chart { max-width: 900px; max-height: 52vh; }
.slide svg.chart text { font-size: 13px; }
.slide .actions li, .slide .method li { margin-bottom: 12px; }
.slide .actions strong { display: block; }
.slide .method li { font-size: 18px; }
.slide blockquote.quote { font-size: 20px; max-width: 50em; }
.slide .banner { font-size: 20px; }
.deck-nav {
  position: fixed;
  right: 16px;
  bottom: 12px;
  font-size: 13px;
  color: ${C.inkMuted};
  background: ${C.page};
  padding: 4px 8px;
  border-radius: 4px;
}
@media print {
  body { background: ${C.page}; }
  .slide, .deck.is-enhanced .slide {
    display: flex;
    width: 13.333in;
    height: 7.5in;
    min-height: 0;
    padding: 0.6in 0.9in;
    overflow: hidden;
    border-bottom: 0;
    break-after: page;
    page-break-after: always;
  }
  .slide:last-of-type { break-after: auto; page-break-after: auto; }
  .deck-nav { display: none; }
}
`;

type Slide = { label: string; body: string };

function renderSlide(slide: Slide, slideNumber: number, total: number): string {
  const label = escapeHtml(`Slide ${slideNumber} of ${total}: ${slide.label}`);
  return `<section class="slide" data-slide="${slideNumber}" aria-label="${label}">${slide.body}</section>`;
}

function titleSlide(input: PulseReportInput): Slide {
  const { facts } = input;
  const meta = [
    `Run ${formatRunDate(facts.completedAt)}`,
    `${formatCount(facts.rowsAnalyzed)} of ${formatCount(facts.rowsInFile)} rows analyzed`,
    facts.modelName,
  ].map((part) => escapeHtml(part)).join(' · ');
  return {
    label: 'Title',
    body: `<p class="eyebrow">PULSE results</p><h1>${escapeHtml(facts.surveyFilename)}</h1><p class="meta">${meta}</p>`,
  };
}

function headlineSlide(input: PulseReportInput): Slide {
  const { narrative, profile } = input;
  if (!narrative) {
    const breakdowns = profile.breakdowns
      .map((breakdown) => `<li>${escapeHtml(summarizeBreakdown(breakdown))}</li>`)
      .join('');
    return {
      label: 'Summary',
      body: `<div class="banner" role="note" data-section="banner">${NARRATIVE_MISSING_BANNER}</div>${breakdowns ? `<ul class="method">${breakdowns}</ul>` : ''}`,
    };
  }
  const overview = narrative.overview
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p class="detail">${escapeHtml(paragraph)}</p>`)
    .join('');
  return {
    label: 'Headline',
    body: `<p class="headline">${escapeHtml(narrative.headline)}</p>${overview}`,
  };
}

type Finding = PulseNarrative['keyFindings'][number];

function columnCaption(column: PulseColumnProfile): string {
  return `<p class="answered">${escapeHtml(`${column.label} · ${describeAnswered(column)}`)}</p>`;
}

// A column's chart, or its selected quotes when it is free text, or its one-line summary.
function renderColumnEvidence(input: PulseReportInput, column: PulseColumnProfile, chartId: string): string {
  const caption = columnCaption(column);
  const summary = `<p class="summary">${escapeHtml(summarizeProfile(column))}</p>`;
  const chart = renderColumnChart(column, chartId);
  if (chart) {
    return `${caption}${chart}`;
  }
  const quotes = selectQuotes(input, MAX_QUOTE_POOL)
    .filter((quote) => quote.columnKey === column.key)
    .slice(0, MAX_SLIDE_QUOTES);
  if (quotes.length > 0) {
    return `${caption}${quotes.map(renderQuote).join('')}`;
  }
  return `${caption}${summary}`;
}

// The column a finding's chart comes from: the first column it cites that the profile knows.
function evidenceColumn(finding: Finding, byLabel: Map<string, PulseColumnProfile>): PulseColumnProfile | null {
  return finding.columns
    .map((label) => byLabel.get(label))
    .find((column): column is PulseColumnProfile => column !== undefined) ?? null;
}

/**
 * A finding's evidence: the chart for the column it cites, plus the quotes it cites so the
 * numbers and the respondents' wording sit together. One quote alongside a chart keeps the
 * slide readable; a finding with neither falls back to whatever its column can show.
 */
function findingEvidence(
  input: PulseReportInput,
  finding: Finding,
  byLabel: Map<string, PulseColumnProfile>,
  chartId: string,
): string {
  const column = evidenceColumn(finding, byLabel);
  const chart = column ? renderColumnChart(column, chartId) : null;
  const quotes = quotesByIds(input, finding.quoteIds).slice(0, chart ? 1 : MAX_SLIDE_QUOTES);

  if (chart === null && quotes.length === 0) {
    return column ? renderColumnEvidence(input, column, chartId) : '';
  }

  const figure = chart && column ? `${columnCaption(column)}${chart}` : '';

  return `${figure}${quotes.map(renderQuote).join('')}`;
}

function findingSlides(input: PulseReportInput, firstSlideNumber: number): Slide[] {
  const { narrative, profile } = input;
  const byLabel = new Map(profile.columns.map((column) => [column.label, column]));

  if (!narrative) {
    return profile.columns
      .filter((column) => renderColumnChart(column, 'probe') !== null)
      .slice(0, MAX_FALLBACK_COLUMN_SLIDES)
      .map((column, position) => ({
        label: column.label,
        body: `<h2>${escapeHtml(column.label)}</h2>${renderColumnEvidence(input, column, `slide-${firstSlideNumber + position}-chart`)}<p class="summary">${escapeHtml(summarizeProfile(column))}</p>`,
      }));
  }

  return narrative.keyFindings.map((finding, position) => ({
    label: finding.title,
    body: [
      `<h2>${escapeHtml(finding.title)}</h2>`,
      `<p class="detail">${escapeHtml(finding.detail)}</p>`,
      findingEvidence(input, finding, byLabel, `slide-${firstSlideNumber + position}-chart`),
    ].join(''),
  }));
}

function actionsSlide(input: PulseReportInput): Slide {
  const { narrative } = input;
  if (!narrative) {
    return { label: 'Recommended actions', body: `<h2>Recommended actions</h2><p class="detail">${ACTIONS_MISSING_MESSAGE}</p>` };
  }
  const items = narrative.recommendedActions
    .map((item) => `<li><strong>${escapeHtml(item.action)}</strong>${escapeHtml(item.rationale)}</li>`)
    .join('');
  return { label: 'Recommended actions', body: `<h2>Recommended actions</h2><ol class="actions">${items}</ol>` };
}

function methodSlide(input: PulseReportInput): Slide {
  const notes = buildMethodNotes(input).map((note) => `<li>${escapeHtml(note)}</li>`).join('');
  return { label: 'Method', body: `<h2>Method and caveats</h2><ul class="method">${notes}</ul>` };
}

/**
 * Chartable columns no finding slide already showed, so a reader can see what else was analyzed
 * without those columns competing with the findings. Empty when there is no narrative, because
 * that deck is already a tour of the columns.
 */
function appendixSlides(input: PulseReportInput): Slide[] {
  const { narrative, profile } = input;

  if (!narrative) {
    return [];
  }

  const byLabel = new Map(profile.columns.map((column) => [column.label, column]));
  const shown = new Set(narrative.keyFindings
    .map((finding) => evidenceColumn(finding, byLabel))
    .filter((column): column is PulseColumnProfile => column !== null)
    .map((column) => column.key));
  const remaining = profile.columns
    .filter((column) => !shown.has(column.key) && renderColumnChart(column, 'probe') !== null);

  if (remaining.length === 0) {
    return [];
  }

  const kept = remaining.slice(0, MAX_APPENDIX_SLIDES);
  const leftOut = remaining.length - kept.length;
  const note = leftOut > 0
    ? `<p class="summary">${escapeHtml(`${formatCount(leftOut)} more columns are in the results dashboard.`)}</p>`
    : '';

  return [
    {
      label: 'Appendix',
      body: `<p class="eyebrow">Appendix</p><h2>Other columns analyzed</h2><p class="detail">These columns were analyzed but did not carry a key finding.</p>${note}`,
    },
    ...kept.map((column, position) => ({
      label: `Appendix: ${column.label}`,
      body: [
        '<p class="eyebrow">Appendix</p>',
        `<h2>${escapeHtml(column.label)}</h2>`,
        renderColumnEvidence(input, column, `appendix-${position}-chart`),
        `<p class="summary">${escapeHtml(summarizeProfile(column))}</p>`,
      ].join(''),
    })),
  ];
}

export default function renderSlides(input: PulseReportInput): string {
  const slides = [
    titleSlide(input),
    headlineSlide(input),
    ...findingSlides(input, 3),
    actionsSlide(input),
    methodSlide(input),
    ...appendixSlides(input),
  ];
  const sections = slides.map((slide, index) => renderSlide(slide, index + 1, slides.length)).join('\n');
  const body = [
    '<main class="deck">',
    sections,
    '</main>',
    `<div class="deck-nav" aria-live="polite"><span data-slide-counter>1 / ${slides.length}</span> · Arrow keys, space, or click to move</div>`,
  ].join('\n');

  return renderHtmlDocument(`PULSE slides: ${input.facts.surveyFilename}`, SLIDES_CSS, body, SLIDE_NAV_SCRIPT);
}
