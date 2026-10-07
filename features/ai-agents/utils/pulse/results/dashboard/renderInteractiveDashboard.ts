import type { PulseReportInput } from '@/features/ai-agents/types/pulse/results';
import {
  formatCount,
  formatRunDate,
  renderHtmlDocument,
} from '@/features/ai-agents/utils/pulse/results/charts';
import { DASHBOARD_CSS } from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardCss';
import { DASHBOARD_SCRIPT } from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardScript';
import renderDeeperDivePage from '@/features/ai-agents/utils/pulse/results/dashboard/renderDeeperDivePage';
import renderInsightsPage from '@/features/ai-agents/utils/pulse/results/dashboard/renderInsightsPage';
import renderOverviewPage from '@/features/ai-agents/utils/pulse/results/dashboard/renderOverviewPage';
import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';

type DashboardPage = {
  id: string;
  tab: string;
  title: string;
  render: (input: PulseReportInput) => string;
};

const PAGES: DashboardPage[] = [
  { id: 'overview', tab: 'Overview', title: 'Executive overview', render: renderOverviewPage },
  { id: 'deeper', tab: 'Deeper dive', title: 'Deeper dive', render: renderDeeperDivePage },
  { id: 'insights', tab: 'Insights & actions', title: 'Insights and actions', render: renderInsightsPage },
];

function renderHeader(input: PulseReportInput): string {
  const { facts } = input;
  const meta = [
    `Run ${formatRunDate(facts.completedAt)}`,
    `${formatCount(facts.rowsAnalyzed)} of ${formatCount(facts.rowsInFile)} rows analyzed`,
    facts.modelName,
  ].map((part) => escapeHtml(part)).join(' · ');

  return `<header data-section="header"><h1>Results: ${escapeHtml(facts.surveyFilename)}</h1><p class="meta">${meta}</p></header>`;
}

function renderTabs(): string {
  const tabs = PAGES
    .map(({ id, tab }, index) => `<a role="tab" id="tab-${id}" href="#${id}" data-tab="${id}" aria-controls="${id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${escapeHtml(tab)}</a>`)
    .join('');

  return `<nav class="tabs" role="tablist" aria-label="Dashboard pages">${tabs}</nav>`;
}

export default function renderInteractiveDashboard(input: PulseReportInput): string {
  const pages = PAGES.map(({ id, title, render }) => [
    `<section class="page" id="${id}" role="tabpanel" aria-labelledby="tab-${id}" data-page="${id}">`,
    `<h2 class="page-title">${escapeHtml(title)}</h2>`,
    render(input),
    '</section>',
  ].join(''));
  const body = ['<main>', renderHeader(input), renderTabs(), ...pages, '</main>'].join('\n');

  return renderHtmlDocument(`PULSE results: ${input.facts.surveyFilename}`, DASHBOARD_CSS, body, DASHBOARD_SCRIPT);
}
