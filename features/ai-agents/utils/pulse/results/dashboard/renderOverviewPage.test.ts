import renderOverviewPage from '@/features/ai-agents/utils/pulse/results/dashboard/renderOverviewPage';
import {
  ESCAPED_INJECTION,
  SCRIPT_TAG,
  buildInjectedReportInput,
  buildNarrative,
  buildProfile,
  buildReportInput,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

function mount(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

function kpi(doc: Document, kind: string): { value: string; label: string } | null {
  const tile = doc.querySelector(`[data-kpi="${kind}"]`);

  return tile === null
    ? null
    : { value: tile.querySelector('.kpi-value')?.textContent ?? '', label: tile.querySelector('.kpi-label')?.textContent ?? '' };
}

function chartKeys(doc: Document): string[] {
  return Array.from(doc.querySelectorAll('[data-part="charts"] figure')).map((figure) => figure.getAttribute('data-column-key') ?? '');
}

describe('renderOverviewPage', () => {
  it('leads with the headline', () => {
    const doc = mount(renderOverviewPage(buildReportInput()));

    expect(doc.querySelector('[data-part="headline"]')?.textContent).toBe(buildNarrative().headline);
    expect(doc.querySelector('[data-part="banner"]')).toBeNull();
  });

  it('shows respondents and rows analyzed', () => {
    const doc = mount(renderOverviewPage(buildReportInput()));

    expect(kpi(doc, 'respondents')?.value).toBe('50');
    expect(kpi(doc, 'analyzed')?.value).toBe('49');
  });

  it('shows the top answer of the first featured column when it is categorical', () => {
    const doc = mount(renderOverviewPage(buildReportInput()));

    expect(kpi(doc, 'top-answer')).toEqual({ value: '53%', label: 'Positive · Sentiment' });
  });

  it('leaves out the top answer when the first featured column is not categorical', () => {
    const input = buildReportInput({ narrative: { ...buildNarrative(), featuredColumns: ['C – Revenue', 'Sentiment'] } });

    expect(kpi(mount(renderOverviewPage(input)), 'top-answer')).toBeNull();
  });

  it('never reports the Other bucket as the top answer', () => {
    const input = buildReportInput();
    input.profile.columns = input.profile.columns.map((column) => (
      column.key === 'tool:Sentiment' && column.kind === 'categorical'
        ? { ...column, counts: [{ value: 'Other (4 values)', count: 30 }, { value: 'Positive', count: 17 }] }
        : column
    ));

    expect(kpi(mount(renderOverviewPage(input)), 'top-answer')?.label).toBe('Positive · Sentiment');
  });

  it('lists findings going well and needing attention, each linking to its topic', () => {
    const doc = mount(renderOverviewPage(buildReportInput()));
    const links = (tone: string) => Array.from(doc.querySelectorAll(`[data-tone-list="${tone}"] a`)).map((link) => link.getAttribute('href'));

    expect(links('positive')).toEqual(['#insights/1']);
    expect(links('concern')).toEqual(['#insights/3']);
    expect(doc.querySelector('[data-tone-list="neutral"]')).toBeNull();
  });

  it('leaves out the tone lists when every finding is neutral', () => {
    const narrative = buildNarrative();
    const input = buildReportInput({
      narrative: { ...narrative, keyFindings: narrative.keyFindings.map((finding) => ({ ...finding, tone: 'neutral' as const })) },
    });

    expect(mount(renderOverviewPage(input)).querySelector('[data-tone-list]')).toBeNull();
  });

  it('shows at most three featured charts, in the order the summary featured them', () => {
    const input = buildReportInput({
      narrative: { ...buildNarrative(), featuredColumns: ['Sentiment', 'C – Revenue', 'D – Submitted', 'B – Region'] },
    });

    expect(chartKeys(mount(renderOverviewPage(input)))).toEqual(['tool:Sentiment', 'survey:C', 'survey:D']);
  });

  it('heads a featured chart with the finding it supports', () => {
    const doc = mount(renderOverviewPage(buildReportInput()));

    expect(doc.querySelector('[data-column-key="tool:Sentiment"] h3')?.textContent).toBe('North is the most positive region');
  });

  it('falls back to the first chartable columns when the summary featured none', () => {
    const input = buildReportInput({ narrative: { ...buildNarrative(), featuredColumns: [] } });

    expect(chartKeys(mount(renderOverviewPage(input)))).toEqual(['survey:B', 'survey:C', 'survey:D']);
  });

  it('shows the banner, the row counts, and the first charts when there is no written summary', () => {
    const doc = mount(renderOverviewPage(buildReportInput({ narrative: null })));

    expect(doc.querySelector('[data-part="banner"]')).not.toBeNull();
    expect(doc.querySelector('[data-part="headline"]')).toBeNull();
    expect(kpi(doc, 'respondents')).not.toBeNull();
    expect(kpi(doc, 'top-answer')).toBeNull();
    expect(doc.querySelector('[data-tone-list]')).toBeNull();
    expect(chartKeys(doc)).toEqual(['survey:B', 'survey:C', 'survey:D']);
  });

  it('shows no charts for a survey with nothing to chart', () => {
    const input = buildReportInput({ narrative: null });
    input.profile.columns = buildProfile().columns.filter((column) => column.kind === 'freeText');

    expect(mount(renderOverviewPage(input)).querySelector('[data-part="charts"]')).toBeNull();
  });

  it('escapes survey and model text', () => {
    const html = renderOverviewPage(buildInjectedReportInput());

    expect(html).not.toMatch(SCRIPT_TAG);
    expect(html).toContain(ESCAPED_INJECTION);
  });
});
