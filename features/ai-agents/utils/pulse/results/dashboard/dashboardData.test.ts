import {
  groupBreakdowns,
  selectDashboardCharts,
} from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardData';
import {
  buildBreakdown,
  buildNarrative,
  buildReportInput,
} from '@/features/ai-agents/utils/pulse/results/testFixtures';

describe('selectDashboardCharts', () => {
  it('uses the columns the summary featured, in its order', () => {
    expect(selectDashboardCharts(buildReportInput()).map(({ column }) => column.key)).toEqual(['tool:Sentiment', 'survey:C']);
  });

  it('falls back to every chartable column, skipping identifiers, when nothing was featured', () => {
    const input = buildReportInput({ narrative: { ...buildNarrative(), featuredColumns: [] } });

    expect(selectDashboardCharts(input).map(({ column }) => column.key)).toEqual([
      'survey:B',
      'survey:C',
      'survey:D',
      'tool:Sentiment',
    ]);
  });

  it('gives every chart its own id', () => {
    const ids = selectDashboardCharts(buildReportInput({ narrative: null })).map(({ chartId }) => chartId);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('groupBreakdowns', () => {
  it('collects breakdowns by the survey column they split on, widest gap first', () => {
    const groups = groupBreakdowns([
      buildBreakdown({ toolKey: 'tool:A', score: 0.1 }),
      buildBreakdown({ toolKey: 'tool:B', groupKey: 'survey:G', groupLabel: 'G – Tenure', score: 0.5 }),
      buildBreakdown({ toolKey: 'tool:C', score: 0.2 }),
    ]);

    expect(groups.map((group) => [group.label, group.breakdowns.map((breakdown) => breakdown.toolKey)])).toEqual([
      ['G – Tenure', ['tool:B']],
      ['B – Region', ['tool:C', 'tool:A']],
    ]);
  });

  it('returns nothing when there are no breakdowns', () => {
    expect(groupBreakdowns([])).toEqual([]);
  });
});
