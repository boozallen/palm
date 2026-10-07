import type {
  PulseBreakdown,
  PulseColumnProfile,
  PulseReportInput,
} from '@/features/ai-agents/types/pulse/results';
import { renderColumnChart } from '@/features/ai-agents/utils/pulse/results/charts';
import {
  selectFeatured,
  type FeaturedColumn,
  type IndexedColumn,
} from '@/features/ai-agents/utils/pulse/results/renderResultsDashboard';

export const MAX_FEATURED_CHARTS = 6;
export const OVERVIEW_CHART_COUNT = 3;
export const MAX_BREAKDOWNS_PER_GROUP = 3;

export type BreakdownGroup = { key: string; label: string; breakdowns: PulseBreakdown[] };

export function indexColumns(input: PulseReportInput): Map<string, IndexedColumn> {
  return new Map(input.profile.columns.map((column, index) => [column.label, { column, index }]));
}

export function isChartable(column: PulseColumnProfile): boolean {
  return column.kind !== 'identifier' && renderColumnChart(column, 'probe') !== null;
}

// The model's featured columns, or the first chartable ones when it named none or wrote nothing.
export function selectDashboardCharts(input: PulseReportInput): FeaturedColumn[] {
  const featured = input.narrative ? selectFeatured(input.narrative, indexColumns(input)) : [];

  if (featured.length > 0) {
    return featured.slice(0, MAX_FEATURED_CHARTS);
  }

  return input.profile.columns
    .filter(isChartable)
    .slice(0, MAX_FEATURED_CHARTS)
    .map((column, position) => ({ column, chartId: `featured-${position}`, heading: undefined }));
}

// One entry per survey column the tool columns were split by, the grouping with the widest gap first.
export function groupBreakdowns(breakdowns: PulseBreakdown[]): BreakdownGroup[] {
  const groups = new Map<string, BreakdownGroup>();

  breakdowns.forEach((breakdown) => {
    const group = groups.get(breakdown.groupKey) ?? { key: breakdown.groupKey, label: breakdown.groupLabel, breakdowns: [] };
    group.breakdowns.push(breakdown);
    groups.set(breakdown.groupKey, group);
  });

  const best = (group: BreakdownGroup) => Math.max(...group.breakdowns.map((breakdown) => breakdown.score));

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      breakdowns: [...group.breakdowns].sort((a, b) => b.score - a.score).slice(0, MAX_BREAKDOWNS_PER_GROUP),
    }))
    .sort((a, b) => best(b) - best(a));
}

export function breakdownRowCount(input: PulseReportInput): number {
  return input.facts.rowsAnalyzed + input.facts.failedRowCount;
}
