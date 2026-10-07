import type {
  PulseBreakdown,
  PulseNarrative,
  PulseReportInput,
  PulseResultsProfile,
  PulseRunFacts,
} from '@/features/ai-agents/types/pulse/results';

export const INJECTION = '<script>alert(1)</script>';

export const ESCAPED_INJECTION = '&lt;script&gt;alert(1)&lt;/script&gt;';

// Anything a generated file could load from the network.
export const NETWORK_REFERENCE = /https?:\/\/|src=|@import|<link|url\(/i;

// Case-insensitive because a browser runs <SCRIPT> too, so a check that misses it proves nothing.
export const SCRIPT_TAG = /<script/i;

export function countScriptTags(html: string): number {
  return (html.match(/<script/gi) ?? []).length;
}

export function buildFacts(): PulseRunFacts {
  return {
    surveyFilename: 'customer-survey.xlsx',
    modelName: 'Claude Sonnet',
    completedAt: new Date('2026-09-25T15:00:00Z'),
    rowsInFile: 50,
    rowsAnalyzed: 49,
    failedRowCount: 1,
  };
}

export function buildProfile(): PulseResultsProfile {
  return {
    columns: [
      {
        key: 'survey:A',
        label: 'A – Respondent ID',
        source: 'survey',
        answeredCount: 50,
        rowCount: 50,
        fallbackCount: 0,
        kind: 'identifier',
        distinctCount: 50,
      },
      {
        key: 'survey:B',
        label: 'B – Region',
        source: 'survey',
        answeredCount: 48,
        rowCount: 50,
        fallbackCount: 0,
        kind: 'categorical',
        counts: [
          { value: 'North', count: 20 },
          { value: 'South', count: 16 },
          { value: 'West', count: 12 },
        ],
      },
      {
        key: 'survey:C',
        label: 'C – Revenue',
        source: 'survey',
        answeredCount: 45,
        rowCount: 50,
        fallbackCount: 0,
        kind: 'numeric',
        min: 100,
        max: 5000,
        mean: 1830.5,
        median: 1500,
        bins: [
          { from: 100, to: 1080, count: 10 },
          { from: 1080, to: 2060, count: 15 },
          { from: 2060, to: 3040, count: 10 },
          { from: 3040, to: 4020, count: 6 },
          { from: 4020, to: 5000, count: 4 },
        ],
      },
      {
        key: 'survey:D',
        label: 'D – Submitted',
        source: 'survey',
        answeredCount: 50,
        rowCount: 50,
        fallbackCount: 0,
        kind: 'date',
        min: '2026-01-04',
        max: '2026-03-28',
        months: [
          { value: '2026-01', count: 18 },
          { value: '2026-02', count: 20 },
          { value: '2026-03', count: 12 },
        ],
      },
      {
        key: 'survey:E',
        label: 'E – Comments',
        source: 'survey',
        answeredCount: 40,
        rowCount: 50,
        fallbackCount: 0,
        kind: 'freeText',
      },
      {
        key: 'survey:F',
        label: 'F – Notes',
        source: 'survey',
        answeredCount: 0,
        rowCount: 50,
        fallbackCount: 0,
        kind: 'empty',
      },
      {
        key: 'tool:Sentiment',
        label: 'Sentiment',
        source: 'tool',
        answeredCount: 47,
        rowCount: 50,
        fallbackCount: 3,
        kind: 'categorical',
        counts: [
          { value: 'Positive', count: 25 },
          { value: 'Neutral', count: 12 },
          { value: 'Negative', count: 10 },
        ],
      },
      {
        key: 'tool:Summary',
        label: 'Summary',
        source: 'tool',
        answeredCount: 50,
        rowCount: 50,
        fallbackCount: 0,
        kind: 'freeText',
      },
    ],
    breakdowns: [
      {
        toolKey: 'tool:Sentiment',
        toolLabel: 'Sentiment',
        groupKey: 'survey:B',
        groupLabel: 'B – Region',
        values: ['Positive', 'Neutral', 'Negative'],
        overall: [25, 12, 10],
        groups: [
          { group: 'North', total: 20, counts: [14, 4, 2] },
          { group: 'South', total: 15, counts: [6, 5, 4] },
          { group: 'West', total: 12, counts: [5, 3, 4] },
        ],
        score: 0.17,
      },
    ],
    quotes: [
      { id: 'q1', rowNumber: 3, columnKey: 'survey:E', columnLabel: 'E – Comments', text: 'The onboarding took too long.' },
      { id: 'q2', rowNumber: 12, columnKey: 'survey:E', columnLabel: 'E – Comments', text: 'Support answered within an hour.' },
      { id: 'q3', rowNumber: 30, columnKey: 'tool:Summary', columnLabel: 'Summary', text: 'Customer wants faster onboarding.' },
      { id: 'q4', rowNumber: 41, columnKey: 'survey:E', columnLabel: 'E – Comments', text: 'Nothing else to add.' },
    ],
  };
}

export function buildNarrative(): PulseNarrative {
  return {
    headline: 'Most customers are positive, but onboarding speed is the top complaint.',
    overview: 'Just over half of analyzed responses are positive.\n\nComments point at onboarding as the main source of friction.',
    keyFindings: [
      {
        title: 'North is the most positive region',
        detail: '14 of 20 North respondents are positive, against 25 of 47 overall.',
        columns: ['Sentiment', 'B – Region'],
        quoteIds: ['q2'],
        tone: 'positive',
        whyItMatters: 'What works in the North could lift the other regions.',
        caveat: null,
      },
      {
        title: 'Revenue clusters under 2,060',
        detail: '25 of 45 revenue answers fall below 2,060.',
        columns: ['C – Revenue'],
        quoteIds: [],
        tone: 'neutral',
        whyItMatters: null,
        caveat: 'Five rows left revenue blank.',
      },
      {
        title: 'Onboarding comes up in comments',
        detail: 'Onboarding is the most repeated theme in free-text comments.',
        columns: ['E – Comments'],
        quoteIds: ['q1', 'q3'],
        tone: 'concern',
        whyItMatters: 'Slow onboarding is the first thing new customers notice.',
        caveat: null,
      },
    ],
    recommendedActions: [
      { action: 'Shorten onboarding', rationale: 'It is the most repeated complaint.', finding: 3 },
      { action: 'Study the North region', rationale: 'It is the most positive group.', finding: 1 },
      { action: 'Follow up with negative respondents', rationale: 'Ten responses were negative.', finding: null },
    ],
    columnNotes: {
      'B – Region': 'North is the largest group.',
      Sentiment: 'Three responses fell back.',
    },
    featuredColumns: ['Sentiment', 'C – Revenue'],
    quoteIds: ['q1', 'q2'],
  };
}

export function buildReportInput(overrides: Partial<PulseReportInput> = {}): PulseReportInput {
  return {
    facts: buildFacts(),
    profile: buildProfile(),
    narrative: buildNarrative(),
    ...overrides,
  };
}

export function buildBreakdown(overrides: Partial<PulseBreakdown> = {}): PulseBreakdown {
  return { ...buildProfile().breakdowns[0], ...overrides };
}

// Region and Tenure groupings; Tenure has the wider gap.
export function buildTwoGroupingInput(): PulseReportInput {
  const input = buildReportInput();

  input.profile.breakdowns = [
    buildBreakdown(),
    buildBreakdown({ groupKey: 'survey:G', groupLabel: 'G – Tenure', score: 0.3 }),
  ];

  return input;
}

// The injection string in every place survey or model text reaches an output.
export function buildInjectedReportInput(): PulseReportInput {
  const input = buildReportInput();
  const injectedLabel = `B – ${INJECTION}`;

  input.facts.surveyFilename = `${INJECTION}.xlsx`;
  input.profile.columns = input.profile.columns.map((column) => {
    if (column.key !== 'survey:B' || column.kind !== 'categorical') {
      return column;
    }
    return {
      ...column,
      label: injectedLabel,
      counts: column.counts.map((count, index) => (index === 0 ? { ...count, value: INJECTION } : count)),
    };
  });
  input.profile.breakdowns = input.profile.breakdowns.map((breakdown) => ({
    ...breakdown,
    groupLabel: injectedLabel,
    groups: breakdown.groups.map((group, index) => (index === 0 ? { ...group, group: INJECTION } : group)),
  }));
  input.profile.quotes = input.profile.quotes.map((quote, index) => (index === 0 ? { ...quote, text: INJECTION } : quote));

  const narrative = buildNarrative();
  input.narrative = {
    ...narrative,
    headline: INJECTION,
    overview: INJECTION,
    keyFindings: [
      {
        title: INJECTION,
        detail: INJECTION,
        columns: [injectedLabel],
        quoteIds: ['q1'],
        tone: 'concern',
        whyItMatters: INJECTION,
        caveat: INJECTION,
      },
      ...narrative.keyFindings.slice(1),
    ],
    recommendedActions: [
      { action: INJECTION, rationale: INJECTION, finding: 1 },
      ...narrative.recommendedActions.slice(1),
    ],
    columnNotes: { [injectedLabel]: INJECTION },
    featuredColumns: [injectedLabel, 'C – Revenue'],
  };

  return input;
}
