import renderInteractiveDashboard from '@/features/ai-agents/utils/pulse/results/dashboard/renderInteractiveDashboard';
import { DASHBOARD_SCRIPT } from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardScript';
import {
  ESCAPED_INJECTION,
  NETWORK_REFERENCE,
  buildInjectedReportInput,
  buildReportInput,
  countScriptTags,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

function mount(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('renderInteractiveDashboard', () => {
  it('is a complete HTML document carrying its own script', () => {
    const html = renderInteractiveDashboard(buildReportInput());

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain(DASHBOARD_SCRIPT);
    expect(countScriptTags(html)).toBe(1);
  });

  it('loads nothing from the network', () => {
    expect(renderInteractiveDashboard(buildReportInput())).not.toMatch(NETWORK_REFERENCE);
  });

  it('shows the run header with the rows analyzed', () => {
    const header = mount(renderInteractiveDashboard(buildReportInput())).querySelector('[data-section="header"]');

    expect(header?.textContent).toContain('customer-survey.xlsx');
    expect(header?.textContent).toContain('49 of 50 rows analyzed');
  });

  it('has three pages, each with its own tab', () => {
    const doc = mount(renderInteractiveDashboard(buildReportInput()));
    const pages = Array.from(doc.querySelectorAll('[data-page]')).map((page) => page.getAttribute('data-page'));
    const tabs = Array.from(doc.querySelectorAll('[role="tab"]')).map((tab) => tab.getAttribute('href'));

    expect(pages).toEqual(['overview', 'deeper', 'insights']);
    expect(tabs).toEqual(['#overview', '#deeper', '#insights']);
  });

  it('shows every page before the script runs, so the file reads without it', () => {
    const doc = mount(renderInteractiveDashboard(buildReportInput()));

    expect(Array.from(doc.querySelectorAll('[hidden]'))).toHaveLength(0);
  });

  it('gives every element a unique id that no survey header can shape', () => {
    const input = buildInjectedReportInput();
    input.profile.columns = [...input.profile.columns, ...input.profile.columns];
    const ids = Array.from(mount(renderInteractiveDashboard(input)).querySelectorAll('[id]')).map((element) => element.id);

    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9/-]+$/));
  });

  it('escapes survey and model text, leaving only its own script', () => {
    const html = renderInteractiveDashboard(buildInjectedReportInput());

    expect(countScriptTags(html)).toBe(1);
    expect(html).toContain(ESCAPED_INJECTION);
  });
});
