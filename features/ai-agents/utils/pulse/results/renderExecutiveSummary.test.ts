import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';
import { NARRATIVE_MISSING_BANNER } from '@/features/ai-agents/utils/pulse/results/charts';
import renderExecutiveSummary, {
  MAX_SUMMARY_ACTIONS,
  MAX_SUMMARY_CHARTS,
  MAX_SUMMARY_FINDINGS,
} from '@/features/ai-agents/utils/pulse/results/renderExecutiveSummary';
import {
  ESCAPED_INJECTION,
  INJECTION,
  NETWORK_REFERENCE,
  SCRIPT_TAG,
  buildInjectedReportInput,
  buildNarrative,
  buildReportInput,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';
import type { PulseNarrative, PulseReportInput } from '@/features/ai-agents/types/pulse/results';

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

// Each finding and action opens with a bold title, so that marks an item; support lines nest.
function listItems(html: string, listClass: string): string[] {
  const start = html.indexOf(`<ol class="${listClass}">`);
  const list = html.slice(start, html.indexOf('</ol>', start));

  return list.split('<li><strong>').slice(1);
}

function withNarrative(overrides: Partial<PulseNarrative>): PulseReportInput {
  return buildReportInput({ narrative: { ...buildNarrative(), ...overrides } });
}

// Six of each, the most the narrative schema allows, so the page caps have something to cut.
function buildLongNarrative(): PulseReportInput {
  const base = buildNarrative();

  return withNarrative({
    keyFindings: [
      ...base.keyFindings,
      { title: 'Fourth finding', detail: 'Detail four.', columns: [], quoteIds: [], tone: 'neutral', whyItMatters: null, caveat: null },
      { title: 'Fifth finding', detail: 'Detail five.', columns: [], quoteIds: [], tone: 'neutral', whyItMatters: null, caveat: null },
      { title: 'Sixth finding', detail: 'Detail six.', columns: [], quoteIds: [], tone: 'neutral', whyItMatters: null, caveat: null },
    ],
    recommendedActions: [
      ...base.recommendedActions,
      { action: 'Fourth action', rationale: 'Because four.', finding: null },
      { action: 'Fifth action', rationale: 'Because five.', finding: null },
      { action: 'Sixth action', rationale: 'Because six.', finding: null },
    ],
  });
}

describe('renderExecutiveSummary', () => {
  it('is a complete HTML document laid out for Letter pages', () => {
    const html = renderExecutiveSummary(buildReportInput());

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('@page { size: Letter;');
  });

  // A leader reads the result first; the run's provenance is what they check afterwards.
  it('opens on the takeaway, not on the run details', () => {
    const html = renderExecutiveSummary(buildReportInput());
    const header = html.slice(html.indexOf('data-section="header"'), html.indexOf('data-section="headline"'));

    expect(header).toContain('customer-survey.xlsx');
    expect(header).not.toContain('49 of 50 rows analyzed');
    expect(html.indexOf('data-section="headline"')).toBeLessThan(html.indexOf('data-section="findings"'));
  });

  it('pairs the headline with the most important action', () => {
    const input = buildReportInput();
    const html = renderExecutiveSummary(input);
    const opening = html.slice(html.indexOf('data-section="headline"'), html.indexOf('data-section="findings"'));

    expect(opening).toContain(input.narrative?.headline ?? 'missing');
    expect(opening).toContain('Shorten onboarding');
    expect(opening).not.toContain('Study the North region');
  });

  it('shows the file, run date, and rows', () => {
    const html = renderExecutiveSummary(buildReportInput());

    expect(html).toContain('customer-survey.xlsx');
    expect(html).toContain('September 25, 2026');
    expect(html).toContain('49 of 50 rows analyzed');
  });

  it('shows the headline and every key finding with its supporting numbers', () => {
    const input = buildReportInput();
    const html = renderExecutiveSummary(input);

    expect(html).toContain(input.narrative?.headline ?? 'missing');
    input.narrative?.keyFindings.forEach((finding) => {
      expect(html).toContain(finding.title);
    });
    expect(html).toContain('Most common: Positive, 53% (25 of 47).');
    expect(html).toContain('Median 1,500; mean 1,830.5; range 100 to 5,000.');
  });

  // One column's numbers per finding; the rest are a click away rather than on the page.
  it('backs each finding with one supporting column', () => {
    const html = renderExecutiveSummary(buildReportInput());
    const findings = html.slice(html.indexOf('data-section="findings"'), html.indexOf('data-section="charts"'));

    expect(findings).toContain('Sentiment: Most common: Positive');
    expect(findings).not.toContain('Most common: North, 42% (20 of 48).');
  });

  it('lists every recommended action with its rationale', () => {
    const input = buildReportInput();
    const html = renderExecutiveSummary(input);

    input.narrative?.recommendedActions.forEach((item) => {
      expect(html).toContain(item.action);
      expect(html).toContain(item.rationale);
    });
  });

  it('draws the featured charts, titled by the finding each one supports', () => {
    const html = renderExecutiveSummary(buildReportInput());
    const charts = html.slice(html.indexOf('data-section="charts"'), html.indexOf('data-section="actions"'));

    expect(charts).toContain('<h3>North is the most positive region</h3>');
    expect(charts).toContain('<h3>Revenue clusters under 2,060</h3>');
    expect(charts).toContain('Three responses fell back.');
    expect(charts).toContain('<svg');
  });

  it('draws no more charts than the page can carry', () => {
    const html = renderExecutiveSummary(withNarrative({
      featuredColumns: ['Sentiment', 'C – Revenue', 'B – Region', 'D – Submitted'],
    }));

    expect(countMatches(html, /<svg/g)).toBe(MAX_SUMMARY_CHARTS);
  });

  // A featured free-text column has nothing to plot, so the next one that does takes its place.
  it('skips a featured column with no chart', () => {
    const html = renderExecutiveSummary(withNarrative({ featuredColumns: ['Summary', 'Sentiment'] }));
    const charts = html.slice(html.indexOf('data-section="charts"'));

    expect(countMatches(html, /<svg/g)).toBe(1);
    expect(charts).toContain('data-column-key="tool:Sentiment"');
  });

  it('leaves the charts out when the narrative featured nothing chartable', () => {
    const html = renderExecutiveSummary(withNarrative({ featuredColumns: ['Summary', 'F – Notes'] }));

    expect(html).not.toContain('data-section="charts"');
    expect(html).not.toContain('<svg');
  });

  it('carries only the top findings and actions, and says where the rest are', () => {
    const html = renderExecutiveSummary(buildLongNarrative());
    const findings = listItems(html, 'findings');
    const actions = listItems(html, 'actions');

    expect(findings).toHaveLength(MAX_SUMMARY_FINDINGS);
    expect(actions).toHaveLength(MAX_SUMMARY_ACTIONS);
    expect(html).not.toContain('Fourth finding');
    expect(html).not.toContain('Fourth action');
    expect(html).toContain('6 further findings and actions, and every column, are in the results dashboard.');
  });

  it('points at the dashboard even when nothing was cut', () => {
    const html = renderExecutiveSummary(buildReportInput());

    expect(html).toContain('Every column is in the results dashboard.');
  });

  it('shows one quote', () => {
    const html = renderExecutiveSummary(buildReportInput());

    expect(countMatches(html, /<blockquote class="quote">/g)).toBe(1);
    expect(html).toContain('The onboarding took too long.');
  });

  it('ends with a one-line method note', () => {
    const html = renderExecutiveSummary(buildReportInput());

    expect(html).toContain('data-section="method"');
    expect(html).toContain('1 failed row was skipped. Numbers are computed from the data; the text is written by Claude Sonnet.');
  });

  it('never references the network and contains no script', () => {
    const html = renderExecutiveSummary(buildReportInput());

    expect(html).not.toMatch(NETWORK_REFERENCE);
    expect(html).not.toMatch(SCRIPT_TAG);
  });

  it('escapes injected text from headers, values, quotes, the file name, and the narrative', () => {
    const html = renderExecutiveSummary(buildInjectedReportInput());

    expect(html).not.toContain(INJECTION);
    expect(html).toContain(ESCAPED_INJECTION);
  });

  it('shows the banner and the numbers for every column and breakdown when there is no narrative', () => {
    const input = buildReportInput({ narrative: null });
    const html = renderExecutiveSummary(input);

    expect(html).toContain(NARRATIVE_MISSING_BANNER);
    input.profile.columns.forEach((column) => {
      expect(html).toContain(escapeHtml(column.label));
    });
    expect(html).toContain('Sentiment by B – Region: biggest difference is North');
    expect(html).toContain('Numbers are computed from the data; the written summary couldn');
  });
});
