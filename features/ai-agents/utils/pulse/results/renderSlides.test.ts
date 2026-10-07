import { NARRATIVE_MISSING_BANNER } from '@/features/ai-agents/utils/pulse/results/charts';
import renderSlides, {
  ACTIONS_MISSING_MESSAGE,
  SLIDE_NAV_SCRIPT,
} from '@/features/ai-agents/utils/pulse/results/renderSlides';
import {
  ESCAPED_INJECTION,
  INJECTION,
  NETWORK_REFERENCE,
  countScriptTags,
  buildInjectedReportInput,
  buildReportInput,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

function slideCount(html: string): number {
  return (html.match(/<section class="slide"/g) ?? []).length;
}

function slideSection(html: string, slideNumber: number): string {
  const start = html.indexOf(`data-slide="${slideNumber}"`);
  const end = html.indexOf('</section>', start);
  return html.slice(start, end);
}

function mountDeck(html: string): HTMLElement[] {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
  const script = document.createElement('script');
  script.textContent = SLIDE_NAV_SCRIPT;
  document.body.appendChild(script);
  return Array.from(document.querySelectorAll<HTMLElement>('section.slide'));
}

function activeIndex(slides: HTMLElement[]): number {
  return slides.findIndex((slide) => slide.classList.contains('is-active'));
}

function press(key: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('renderSlides', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is a complete HTML document', () => {
    expect(renderSlides(buildReportInput()).startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('has title, headline, one slide per key finding, actions, method, then the appendix', () => {
    // Two opening slides, the fixture's 3 findings, actions, method, an appendix divider,
    // and the two charted columns no finding showed.
    expect(slideCount(renderSlides(buildReportInput()))).toBe(10);
  });

  it('puts the file, run date, and rows on the title slide', () => {
    const title = slideSection(renderSlides(buildReportInput()), 1);

    expect(title).toContain('customer-survey.xlsx');
    expect(title).toContain('September 25, 2026');
    expect(title).toContain('49 of 50 rows analyzed');
  });

  it('shows the headline on the second slide', () => {
    const input = buildReportInput();

    expect(slideSection(renderSlides(input), 2)).toContain(input.narrative?.headline ?? 'missing');
  });

  it('draws each finding\'s first cited column', () => {
    const html = renderSlides(buildReportInput());

    expect(slideSection(html, 3)).toContain('North is the most positive region');
    expect(slideSection(html, 3)).toContain('<title id="slide-3-chart-title">Sentiment: answer counts</title>');
    expect(slideSection(html, 4)).toContain('<title id="slide-4-chart-title">C – Revenue: distribution of values</title>');
  });

  it('shows selected quotes instead of a chart for a free-text column', () => {
    const finding = slideSection(renderSlides(buildReportInput()), 5);

    expect(finding).toContain('The onboarding took too long.');
    expect(finding).not.toContain('<svg');
  });

  it('puts a quote the finding cites beside its chart', () => {
    const finding = slideSection(renderSlides(buildReportInput()), 3);

    expect(finding).toContain('Sentiment: answer counts');
    expect(finding).toContain('Support answered within an hour.');
  });

  it('puts the charted columns no finding showed in an appendix after the method', () => {
    const html = renderSlides(buildReportInput());

    expect(html.indexOf('Other columns analyzed')).toBeGreaterThan(html.indexOf('Method and caveats'));
    expect(slideSection(html, 9)).toContain('B – Region');
    expect(slideSection(html, 10)).toContain('D – Submitted');
  });

  it('keeps a column a finding already showed out of the appendix', () => {
    const html = renderSlides(buildReportInput());
    const appendix = html.slice(html.indexOf('Other columns analyzed'));

    expect(appendix).not.toContain('Sentiment: answer counts');
    expect(appendix).not.toContain('C – Revenue');
  });

  it('has no appendix when there is no narrative', () => {
    expect(renderSlides(buildReportInput({ narrative: null }))).not.toContain('Other columns analyzed');
  });

  it('lists the recommended actions and the method', () => {
    const input = buildReportInput();
    const html = renderSlides(input);

    input.narrative?.recommendedActions.forEach((item) => {
      expect(slideSection(html, 6)).toContain(item.action);
    });
    expect(slideSection(html, 7)).toContain('Numbers are computed from the data; the text is written by Claude Sonnet.');
  });

  it('shows the banner, a slide per charted column, and the missing-actions message when there is no narrative', () => {
    const html = renderSlides(buildReportInput({ narrative: null }));

    expect(html).toContain(NARRATIVE_MISSING_BANNER);
    expect(html).toContain(ACTIONS_MISSING_MESSAGE);
    // B – Region, C – Revenue, D – Submitted, and Sentiment are the fixture's charted columns.
    expect(slideCount(html)).toBe(4 + 4);
    expect(html).toContain('Sentiment by B – Region');
  });

  it('carries exactly one script, the navigation, and prints one slide per page', () => {
    const html = renderSlides(buildReportInput());

    expect(countScriptTags(html)).toBe(1);
    expect(html).toContain(SLIDE_NAV_SCRIPT);
    expect(SLIDE_NAV_SCRIPT).toContain('ArrowRight');
    expect(html).toContain('@media print');
    expect(html).toContain('break-after: page;');
  });

  it('never references the network', () => {
    expect(renderSlides(buildReportInput())).not.toMatch(NETWORK_REFERENCE);
  });

  it('escapes injected text from headers, values, quotes, the file name, and the narrative', () => {
    const html = renderSlides(buildInjectedReportInput());

    expect(html).not.toContain(INJECTION);
    expect(html).toContain(ESCAPED_INJECTION);
    expect(countScriptTags(html)).toBe(1);
  });

  it('starts on the first slide', () => {
    const slides = mountDeck(renderSlides(buildReportInput()));

    expect(activeIndex(slides)).toBe(0);
  });

  it('moves forward with the right arrow and space, and back with the left arrow', () => {
    const slides = mountDeck(renderSlides(buildReportInput()));

    press('ArrowRight');
    expect(activeIndex(slides)).toBe(1);
    press(' ');
    expect(activeIndex(slides)).toBe(2);
    press('ArrowLeft');
    expect(activeIndex(slides)).toBe(1);
  });

  it('stops at the first and last slides', () => {
    const slides = mountDeck(renderSlides(buildReportInput()));

    press('ArrowLeft');
    expect(activeIndex(slides)).toBe(0);
    press('End');
    press('ArrowRight');
    expect(activeIndex(slides)).toBe(slides.length - 1);
  });

  it('advances on a click in the right of the screen and goes back on the left', () => {
    const slides = mountDeck(renderSlides(buildReportInput()));
    const deck = document.querySelector('.deck');

    deck?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: window.innerWidth - 10 }));
    expect(activeIndex(slides)).toBe(1);
    deck?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10 }));
    expect(activeIndex(slides)).toBe(0);
  });
});
