import buildBreakdowns, { MAX_BREAKDOWNS } from '@/features/ai-agents/utils/pulse/results/buildBreakdowns';
import profileColumns from '@/features/ai-agents/utils/pulse/results/profileColumns';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type {
  PulseBreakdown,
  PulseSurveyColumn,
  PulseToolColumn,
} from '@/features/ai-agents/types/pulse/results';

const SENTIMENT = ['Positive', 'Negative'];

function repeat(value: string, times: number): string[] {
  return Array.from({ length: times }, () => value);
}

function survey(values: string[], letter = 'B', header = 'Region'): PulseSurveyColumn {
  return { letter, header, values };
}

function tool(values: string[], allowedValues: string[] = SENTIMENT, fieldName = 'Sentiment'): PulseToolColumn {
  return {
    fieldName,
    fieldType: allowedValues.length > 0 ? PulseFieldType.CATEGORY : PulseFieldType.FREE_TEXT,
    allowedValues,
    values,
  };
}

function breakdownsFor(surveyColumns: PulseSurveyColumn[], toolColumns: PulseToolColumn[]): PulseBreakdown[] {
  const rowCount = (surveyColumns[0] ?? toolColumns[0]).values.length;
  const profiles = profileColumns({ surveyColumns, toolColumns, rowCount });

  return buildBreakdowns({ profiles, surveyColumns, toolColumns });
}

describe('buildBreakdowns', () => {
  it('cross-tabs a categorical tool column by a categorical survey column', () => {
    const regions = [...repeat('North', 12), ...repeat('South', 8)];
    const sentiment = [
      ...repeat('Positive', 10), ...repeat('Negative', 2),
      ...repeat('Positive', 2), ...repeat('Negative', 6),
    ];

    const [breakdown] = breakdownsFor([survey(regions)], [tool(sentiment)]);

    expect(breakdown).toMatchObject({
      toolKey: 'tool:Sentiment',
      toolLabel: 'Sentiment',
      groupKey: 'survey:B',
      groupLabel: 'B – Region',
      values: ['Positive', 'Negative'],
      overall: [12, 8],
      groups: [
        { group: 'North', total: 12, counts: [10, 2] },
        { group: 'South', total: 8, counts: [2, 6] },
      ],
    });
    // South's 25% positive against 60% overall is the widest gap.
    expect(breakdown.score).toBeCloseTo(0.35);
  });

  it('leaves out rows whose tool value is a fallback or whose group is blank', () => {
    const regions = [...repeat('North', 6), ...repeat('South', 6), '', 'North'];
    const sentiment = [...repeat('Positive', 6), ...repeat('Negative', 6), 'Positive', MATRIX_FALLBACK_VALUE];

    const [breakdown] = breakdownsFor([survey(regions)], [tool(sentiment)]);

    expect(breakdown.overall).toEqual([6, 6]);
    expect(breakdown.groups.map((group) => group.total)).toEqual([6, 6]);
  });

  it('ignores groups under 5 answers when scoring but still lists them', () => {
    const regions = [...repeat('North', 10), ...repeat('South', 10), ...repeat('East', 4)];
    const sentiment = [
      ...repeat('Positive', 5), ...repeat('Negative', 5),
      ...repeat('Positive', 5), ...repeat('Negative', 5),
      ...repeat('Negative', 4),
    ];

    const [breakdown] = breakdownsFor([survey(regions)], [tool(sentiment)]);

    expect(breakdown.groups.map((group) => group.group)).toEqual(['North', 'South', 'East']);
    // Only North and South (50% negative vs 58.3% overall) count; East's 100% would score far higher.
    expect(breakdown.score).toBeCloseTo(1 / 12);
  });

  it('drops a breakdown when no group has 5 answers', () => {
    const regions = [...repeat('North', 4), ...repeat('South', 4)];
    const sentiment = [...repeat('Positive', 4), ...repeat('Negative', 4)];

    expect(breakdownsFor([survey(regions)], [tool(sentiment)])).toEqual([]);
  });

  it('uses survey columns with 2 to 8 values only', () => {
    const rows = 90;
    const groupsOf = (howMany: number) => Array.from({ length: rows }, (_, index) => `G${index % howMany}`);
    const sentiment = Array.from({ length: rows }, (_, index) => (index % 3 === 0 ? 'Positive' : 'Negative'));

    const breakdowns = breakdownsFor(
      [
        survey(repeat('Only', rows), 'A', 'One value'),
        survey(groupsOf(2), 'B', 'Two values'),
        survey(groupsOf(8), 'C', 'Eight values'),
        survey(groupsOf(9), 'D', 'Nine values'),
      ],
      [tool(sentiment)],
    );

    expect(breakdowns.map((breakdown) => breakdown.groupKey).sort()).toEqual(['survey:B', 'survey:C']);
  });

  it('pairs only categorical tool columns with categorical survey columns', () => {
    const rows = 40;
    const regions = Array.from({ length: rows }, (_, index) => (index < 20 ? 'North' : 'South'));
    const sentiment = Array.from({ length: rows }, (_, index) => (index < 15 ? 'Positive' : 'Negative'));
    const amounts = Array.from({ length: rows }, (_, index) => `${index % 7}.5`);
    const comments = Array.from({ length: rows }, (_, index) => `comment ${index}`);

    const breakdowns = breakdownsFor(
      [survey(regions, 'B', 'Region'), survey(amounts, 'C', 'Amount'), survey(comments, 'D', 'Comment')],
      [tool(sentiment), tool(regions, ['North', 'South'], 'Tool region'), tool(comments, [], 'Theme')],
    );

    // Amount profiles as numeric and Comment/Theme as identifiers, so only Region pairs, highest score first.
    expect(breakdowns.map((breakdown) => [breakdown.toolKey, breakdown.groupKey])).toEqual([
      ['tool:Tool region', 'survey:B'],
      ['tool:Sentiment', 'survey:B'],
    ]);
  });

  it('counts tool values rolled into Other under the Other bucket', () => {
    const options = Array.from({ length: 14 }, (_, index) => `option ${index}`);
    const sentiment = [...options, ...repeat('option 0', 6)];
    const regions = [...repeat('North', 10), ...repeat('South', 10)];

    const [breakdown] = breakdownsFor([survey(regions)], [tool(sentiment, options, 'Topic')]);

    expect(breakdown.values).toHaveLength(13);
    expect(breakdown.values[12]).toBe('Other (2 values)');
    expect(breakdown.overall[12]).toBe(2);
    expect(breakdown.overall.reduce((sum, count) => sum + count, 0)).toBe(20);
  });

  it('keeps the 10 highest-scoring breakdowns, highest first, earlier columns winning ties', () => {
    const rows = 40;
    const sentiment = Array.from({ length: rows }, (_, index) => (index < 20 ? 'Positive' : 'Negative'));
    const letters = 'ABCDEFGHIJKL'.split('');
    // Column j swaps j rows between the halves, so its gap is |0.5 - j/20|: A is starkest, K shows none.
    const surveyColumns = letters.map((letter, j) => survey(
      Array.from({ length: rows }, (_, index) => {
        const inFirstHalf = index < 20;
        const swapped = inFirstHalf ? index < j : index - 20 < j;
        return inFirstHalf !== swapped ? 'Group 1' : 'Group 2';
      }),
      letter,
      `Split ${letter}`,
    ));

    const breakdowns = breakdownsFor(surveyColumns, [tool(sentiment)]);

    expect(breakdowns).toHaveLength(MAX_BREAKDOWNS);
    expect(breakdowns.map((breakdown) => breakdown.groupKey)).toEqual(
      'ABCDEFGHIJ'.split('').map((letter) => `survey:${letter}`),
    );
    breakdowns.slice(1).forEach((breakdown, index) => {
      expect(breakdown.score).toBeLessThanOrEqual(breakdowns[index].score);
    });
  });
});
