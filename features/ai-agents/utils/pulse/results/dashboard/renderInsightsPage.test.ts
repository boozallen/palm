import renderInsightsPage from '@/features/ai-agents/utils/pulse/results/dashboard/renderInsightsPage';
import {
  ESCAPED_INJECTION,
  SCRIPT_TAG,
  buildInjectedReportInput,
  buildReportInput,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

function mount(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

function topic(doc: Document, number: number): Element {
  const panel = doc.querySelector(`[data-topic="${number}"]`);

  if (panel === null) {
    throw new Error(`No topic ${number}`);
  }

  return panel;
}

function actionTitles(scope: Element | null): string[] {
  return Array.from(scope?.querySelectorAll('li strong') ?? []).map((title) => title.textContent ?? '');
}

describe('renderInsightsPage', () => {
  it('offers one topic per key finding, the first chosen', () => {
    const doc = mount(renderInsightsPage(buildReportInput()));
    const chips = Array.from(doc.querySelectorAll('[data-topic-option]'));

    expect(chips.map((chip) => chip.getAttribute('data-topic-option'))).toEqual(['1', '2', '3']);
    expect(chips.map((chip) => chip.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(doc.querySelectorAll('[data-topic]')).toHaveLength(3);
  });

  it('shows the insight, evidence, and why it matters for a topic', () => {
    const panel = topic(mount(renderInsightsPage(buildReportInput())), 1);

    expect(panel.querySelector('[data-part="insight"]')?.textContent).toBe('North is the most positive region');
    expect(panel.querySelector('[data-part="evidence"]')).not.toBeNull();
    expect(panel.querySelector('[data-part="why"]')).not.toBeNull();
  });

  it('leaves out why it matters and the caveat when the summary gave none', () => {
    const doc = mount(renderInsightsPage(buildReportInput()));

    expect(topic(doc, 2).querySelector('[data-part="why"]')).toBeNull();
    expect(topic(doc, 2).querySelector('[data-part="caveat"]')).not.toBeNull();
    expect(topic(doc, 1).querySelector('[data-part="caveat"]')).toBeNull();
  });

  it('charts only the topic\'s columns that can be charted', () => {
    const doc = mount(renderInsightsPage(buildReportInput()));
    const keys = (number: number) => Array.from(topic(doc, number).querySelectorAll('[data-part="charts"] figure'))
      .map((figure) => figure.getAttribute('data-column-key'));

    expect(keys(1)).toEqual(['tool:Sentiment', 'survey:B']);
    expect(topic(doc, 3).querySelector('[data-part="charts"]')).toBeNull();
  });

  it('shows the topic\'s own quotes', () => {
    const doc = mount(renderInsightsPage(buildReportInput()));

    expect(topic(doc, 3).querySelectorAll('[data-part="quotes"] blockquote')).toHaveLength(2);
    expect(topic(doc, 2).querySelector('[data-part="quotes"]')).toBeNull();
  });

  it('puts each action under the finding it follows from', () => {
    const doc = mount(renderInsightsPage(buildReportInput()));

    expect(actionTitles(topic(doc, 1).querySelector('[data-part="actions"]'))).toEqual(['Study the North region']);
    expect(actionTitles(topic(doc, 3).querySelector('[data-part="actions"]'))).toEqual(['Shorten onboarding']);
    expect(topic(doc, 2).querySelector('[data-part="actions"]')).toBeNull();
  });

  it('lists every action once at the end, including those tied to no finding', () => {
    const doc = mount(renderInsightsPage(buildReportInput()));
    const inTopics = Array.from(doc.querySelectorAll('[data-topic]')).flatMap((panel) => actionTitles(panel));

    expect(actionTitles(doc.querySelector('[data-part="all-actions"]'))).toEqual([
      'Shorten onboarding',
      'Study the North region',
      'Follow up with negative respondents',
    ]);
    expect(inTopics).not.toContain('Follow up with negative respondents');
  });

  it('explains that topics need the written summary when there is none', () => {
    const doc = mount(renderInsightsPage(buildReportInput({ narrative: null })));

    expect(doc.querySelector('[data-part="topics-missing"]')).not.toBeNull();
    expect(doc.querySelector('[data-topic]')).toBeNull();
  });

  it('escapes survey and model text', () => {
    const html = renderInsightsPage(buildInjectedReportInput());

    expect(html).not.toMatch(SCRIPT_TAG);
    expect(html).toContain(ESCAPED_INJECTION);
  });
});
