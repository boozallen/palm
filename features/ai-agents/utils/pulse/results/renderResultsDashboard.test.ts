import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';
import { NARRATIVE_MISSING_BANNER } from '@/features/ai-agents/utils/pulse/results/charts';
import renderResultsDashboard from '@/features/ai-agents/utils/pulse/results/renderResultsDashboard';
import {
  ESCAPED_INJECTION,
  INJECTION,
  NETWORK_REFERENCE,
  SCRIPT_TAG,
  buildInjectedReportInput,
  buildReportInput,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

describe('renderResultsDashboard', () => {
  it('is a complete HTML document', () => {
    const html = renderResultsDashboard(buildReportInput());

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('shows the run header: file, run date, and rows', () => {
    const html = renderResultsDashboard(buildReportInput());

    expect(html).toContain('customer-survey.xlsx');
    expect(html).toContain('September 25, 2026');
    expect(html).toContain('49 of 50 rows analyzed');
  });

  it('lists every survey and tool column', () => {
    const input = buildReportInput();
    const html = renderResultsDashboard(input);

    input.profile.columns.forEach((column) => {
      expect(html).toContain(escapeHtml(column.label));
      expect(html).toContain(`data-column-key="${escapeHtml(column.key)}"`);
    });
  });

  it('shows the headline, overview paragraphs, and key findings', () => {
    const input = buildReportInput();
    const html = renderResultsDashboard(input);

    expect(html).toContain(input.narrative?.headline ?? 'missing');
    expect(html).toContain('<p>Just over half of analyzed responses are positive.</p>');
    input.narrative?.keyFindings.forEach((finding) => {
      expect(html).toContain(finding.title);
    });
  });

  it('shows the recommended actions after the key findings', () => {
    const input = buildReportInput();
    const html = renderResultsDashboard(input);
    const actions = html.indexOf('data-section="actions"');

    expect(actions).toBeGreaterThan(html.indexOf('data-section="findings"'));
    input.narrative?.recommendedActions.forEach((item) => {
      expect(html).toContain(`<strong>${item.action}</strong>${item.rationale}`);
    });
  });

  it('offers a nav link to every section on the page', () => {
    const html = renderResultsDashboard(buildReportInput());
    const nav = html.slice(html.indexOf('data-section="nav"'), html.indexOf('</nav>'));

    ['summary', 'findings', 'actions', 'featured', 'columns', 'breakdowns', 'quotes', 'method'].forEach((id) => {
      expect(nav).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    });
  });

  // A run with no narrative has no findings or actions to jump to.
  it('leaves sections it did not render out of the nav', () => {
    const html = renderResultsDashboard(buildReportInput({ narrative: null }));
    const nav = html.slice(html.indexOf('data-section="nav"'), html.indexOf('</nav>'));

    expect(nav).not.toContain('href="#findings"');
    expect(nav).not.toContain('href="#actions"');
    expect(nav).not.toContain('href="#featured"');
    expect(nav).toContain('href="#columns"');
  });

  // The page opens on the executive path, with every column one click away.
  it('collapses the every-column charts into an appendix', () => {
    const html = renderResultsDashboard(buildReportInput());
    const appendix = html.indexOf('<details class="appendix">');

    expect(html).toContain('Show all 8 column charts');
    expect(appendix).toBeGreaterThan(-1);
    expect(html.indexOf('id="column-0-figure"')).toBeGreaterThan(appendix);
  });

  it('titles a featured chart with the finding it supports', () => {
    const html = renderResultsDashboard(buildReportInput());
    const featured = html.slice(html.indexOf('data-section="featured"'), html.indexOf('data-section="columns"'));

    expect(featured).toContain('<h3>North is the most positive region</h3>');
    expect(featured).toContain('Sentiment · Answered by 47 of 50');
    expect(featured).toContain('<h3>Revenue clusters under 2,060</h3>');
  });

  // A cited column is linked to the copy that is visible without opening the appendix.
  it('links a finding to the featured chart of a column it cites', () => {
    const html = renderResultsDashboard(buildReportInput());
    const findings = html.slice(html.indexOf('data-section="findings"'), html.indexOf('data-section="actions"'));

    expect(findings).toContain('href="#featured-0-figure"');
    expect(findings).toContain('href="#column-1-figure"');
  });

  it('draws the featured columns before the full column list', () => {
    const html = renderResultsDashboard(buildReportInput());
    const featured = html.indexOf('data-section="featured"');
    const columns = html.indexOf('data-section="columns"');

    expect(featured).toBeGreaterThan(-1);
    expect(html.indexOf('data-featured-key="tool:Sentiment"')).toBeGreaterThan(featured);
    expect(html.indexOf('data-featured-key="survey:C"')).toBeLessThan(columns);
  });

  it('attaches each column note to its column', () => {
    const html = renderResultsDashboard(buildReportInput());

    expect(html).toContain('North is the largest group.');
  });

  it('shows the breakdowns', () => {
    const html = renderResultsDashboard(buildReportInput());

    expect(html).toContain('data-section="breakdowns"');
    expect(html).toContain('Sentiment by B – Region');
  });

  it('shows only the quotes the narrative selected', () => {
    const html = renderResultsDashboard(buildReportInput());

    expect(html).toContain('The onboarding took too long.');
    expect(html).toContain('Support answered within an hour.');
    expect(html).not.toContain('Nothing else to add.');
  });

  it('puts the quotes a finding cites with that finding', () => {
    const html = renderResultsDashboard(buildReportInput());
    const findings = html.slice(html.indexOf('data-section="findings"'), html.indexOf('data-section="actions"'));

    expect(findings).toContain('Customer wants faster onboarding.');
    expect(findings).toContain('The onboarding took too long.');
    expect(findings).not.toContain('Nothing else to add.');
  });

  it('states method and caveats: skipped rows, fallbacks, identifiers, and who wrote the text', () => {
    const html = renderResultsDashboard(buildReportInput());

    expect(html).toContain('data-section="method"');
    expect(html).toContain('1 failed row was skipped.');
    expect(html).toContain('Sentiment: 3 of 50 rows');
    expect(html).toContain('A – Respondent ID was treated as an identifier');
    expect(html).toContain('Numbers are computed from the data; the text is written by Claude Sonnet.');
  });

  it('never references the network', () => {
    expect(renderResultsDashboard(buildReportInput())).not.toMatch(NETWORK_REFERENCE);
  });

  it('contains no script', () => {
    expect(renderResultsDashboard(buildReportInput())).not.toMatch(SCRIPT_TAG);
  });

  it('escapes injected text from headers, values, quotes, the file name, and the narrative', () => {
    const html = renderResultsDashboard(buildInjectedReportInput());

    expect(html).not.toContain(INJECTION);
    expect(html).not.toMatch(SCRIPT_TAG);
    expect(html).toContain(ESCAPED_INJECTION);
  });

  it('shows the banner and still every column and breakdown when there is no narrative', () => {
    const input = buildReportInput({ narrative: null });
    const html = renderResultsDashboard(input);

    expect(html).toContain(NARRATIVE_MISSING_BANNER);
    input.profile.columns.forEach((column) => {
      expect(html).toContain(escapeHtml(column.label));
    });
    expect(html).toContain('Sentiment by B – Region');
    expect(html).not.toContain('data-section="featured"');
  });

  // A survey whose columns all profiled as empty still opens as a readable page.
  it('is a complete document with no figures when nothing profiled', () => {
    const html = renderResultsDashboard(buildReportInput({
      profile: { columns: [], breakdowns: [], quotes: [] },
    }));

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
    expect(html).not.toContain('<figure');
    expect(html).toContain('0 survey columns and 0 tool columns.');
    expect(html).not.toContain('data-section="featured"');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('omits the banner when the narrative exists', () => {
    expect(renderResultsDashboard(buildReportInput())).not.toContain(NARRATIVE_MISSING_BANNER);
  });
});
