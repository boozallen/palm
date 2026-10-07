import renderDeeperDivePage from '@/features/ai-agents/utils/pulse/results/dashboard/renderDeeperDivePage';
import {
  ESCAPED_INJECTION,
  SCRIPT_TAG,
  buildBreakdown,
  buildInjectedReportInput,
  buildNarrative,
  buildReportInput,
  buildTwoGroupingInput,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

function mount(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

function panelBreakdowns(doc: Document, group: number): string[] {
  return Array.from(doc.querySelectorAll(`[data-group="${group}"] figure.breakdown`))
    .map((figure) => figure.getAttribute('data-breakdown-key') ?? '');
}

describe('renderDeeperDivePage', () => {
  it('names the one grouping instead of offering a choice', () => {
    const doc = mount(renderDeeperDivePage(buildReportInput()));

    expect(doc.querySelector('[data-group-label]')?.textContent).toBe('Compared by B – Region');
    expect(doc.querySelector('[data-group-selector]')).toBeNull();
    expect(panelBreakdowns(doc, 0)).toEqual(['tool:Sentiment|survey:B']);
  });

  it('offers every grouping, the one with the widest gap first', () => {
    const doc = mount(renderDeeperDivePage(buildTwoGroupingInput()));
    const options = Array.from(doc.querySelectorAll('[data-group-option]'));

    expect(options.map((option) => option.textContent)).toEqual(['G – Tenure', 'B – Region']);
    expect(options.map((option) => option.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(panelBreakdowns(doc, 0)).toEqual(['tool:Sentiment|survey:G']);
    expect(panelBreakdowns(doc, 1)).toEqual(['tool:Sentiment|survey:B']);
  });

  it('always says which grouping is showing', () => {
    const doc = mount(renderDeeperDivePage(buildTwoGroupingInput()));

    expect(doc.querySelector('[data-group-showing-label]')?.textContent).toBe('G – Tenure');
  });

  it('shows at most three breakdowns per grouping, widest gap first', () => {
    const input = buildReportInput();
    input.profile.breakdowns = [0.1, 0.4, 0.2, 0.3].map((score, index) => buildBreakdown({ toolKey: `tool:T${index}`, score }));

    expect(panelBreakdowns(mount(renderDeeperDivePage(input)), 0)).toEqual([
      'tool:T1|survey:B',
      'tool:T3|survey:B',
      'tool:T2|survey:B',
    ]);
  });

  it('says so when the survey had nothing to compare groups by', () => {
    const input = buildReportInput();
    input.profile.breakdowns = [];
    const doc = mount(renderDeeperDivePage(input));

    expect(doc.querySelector('[data-part="no-groups"]')).not.toBeNull();
    expect(doc.querySelector('[data-group-selector]')).toBeNull();
    expect(doc.querySelector('[data-group]')).toBeNull();
  });

  it('shows featured charts past the first three', () => {
    const input = buildReportInput({
      narrative: { ...buildNarrative(), featuredColumns: ['Sentiment', 'C – Revenue', 'D – Submitted', 'B – Region'] },
    });
    const figures = mount(renderDeeperDivePage(input)).querySelectorAll('[data-part="more-charts"] figure');

    expect(Array.from(figures).map((figure) => figure.getAttribute('data-column-key'))).toEqual(['survey:B']);
  });

  it('leaves out more charts when every featured chart is on the overview', () => {
    expect(mount(renderDeeperDivePage(buildReportInput())).querySelector('[data-part="more-charts"]')).toBeNull();
  });

  it('keeps every question and the method behind collapsed sections', () => {
    const input = buildReportInput();
    const doc = mount(renderDeeperDivePage(input));
    const allQuestions = doc.querySelector('details[data-part="all-questions"]');

    expect(allQuestions?.hasAttribute('open')).toBe(false);
    expect(allQuestions?.querySelectorAll('figure')).toHaveLength(input.profile.columns.length);
    expect(doc.querySelector('details[data-part="method"]')?.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('escapes survey and model text', () => {
    const html = renderDeeperDivePage(buildInjectedReportInput());

    expect(html).not.toMatch(SCRIPT_TAG);
    expect(html).toContain(ESCAPED_INJECTION);
  });
});
