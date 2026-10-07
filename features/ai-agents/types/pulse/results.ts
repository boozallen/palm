import type { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

export type PulseColumnSource = 'survey' | 'tool';

export type PulseColumnKind = 'categorical' | 'numeric' | 'date' | 'freeText' | 'identifier' | 'empty';

export type PulseValueCount = { value: string; count: number };

export type PulseHistogramBin = { from: number; to: number; count: number };

type PulseColumnProfileBase = {
  // 'survey:C' or 'tool:Sentiment' — unique across the run.
  key: string;
  // 'C – Revenue' for survey columns, the field name for tool columns.
  label: string;
  source: PulseColumnSource;
  answeredCount: number;
  rowCount: number;
  // Tool columns only: answers that are MATRIX_FALLBACK_VALUE. Always 0 for survey columns.
  fallbackCount: number;
};

export type PulseColumnProfile = PulseColumnProfileBase & (
  | { kind: 'categorical'; counts: PulseValueCount[] }
  | { kind: 'numeric'; min: number; max: number; mean: number; median: number; bins: PulseHistogramBin[] }
  | { kind: 'date'; min: string; max: string; months: PulseValueCount[] }
  | { kind: 'freeText' }
  | { kind: 'identifier'; distinctCount: number }
  | { kind: 'empty' }
);

export type PulseBreakdown = {
  toolKey: string;
  toolLabel: string;
  groupKey: string;
  groupLabel: string;
  // The tool column's values, in the tool profile's count order.
  values: string[];
  overall: number[];
  groups: Array<{ group: string; total: number; counts: number[] }>;
  score: number;
};

export type PulseQuote = {
  id: string;
  rowNumber: number;
  columnKey: string;
  columnLabel: string;
  text: string;
};

export type PulseResultsProfile = {
  columns: PulseColumnProfile[];
  breakdowns: PulseBreakdown[];
  quotes: PulseQuote[];
};

export const PULSE_FINDING_TONES = ['positive', 'concern', 'neutral'] as const;

export type PulseFindingTone = typeof PULSE_FINDING_TONES[number];

export type PulseNarrative = {
  headline: string;
  overview: string;
  keyFindings: Array<{
    title: string;
    detail: string;
    columns: string[];
    quoteIds: string[];
    tone: PulseFindingTone;
    whyItMatters: string | null;
    caveat: string | null;
  }>;
  // finding is the 1-based position in keyFindings the action follows from.
  recommendedActions: Array<{ action: string; rationale: string; finding: number | null }>;
  columnNotes: Record<string, string>;
  featuredColumns: string[];
  quoteIds: string[];
};

export type PulseOutputKind = 'dashboard' | 'pdf' | 'slides';

export type PulseOutputErrors = Partial<Record<'narrative' | PulseOutputKind, string>>;

export type PulseRunFacts = {
  surveyFilename: string;
  modelName: string;
  completedAt: Date;
  rowsInFile: number;
  rowsAnalyzed: number;
  failedRowCount: number;
};

export type PulseReportInput = {
  facts: PulseRunFacts;
  profile: PulseResultsProfile;
  narrative: PulseNarrative | null;
};

export type PulseResultsOutputs = {
  profile: PulseResultsProfile;
  narrative: PulseNarrative | null;
  dashboardHtml: string | null;
  slidesHtml: string | null;
  executiveSummaryPdf: Buffer | null;
  errors: PulseOutputErrors;
};

// One survey column's values for the analyzed rows, aligned to the rows array by index.
export type PulseSurveyColumn = {
  letter: string;
  header: string;
  values: string[];
};

export type PulseToolColumn = {
  fieldName: string;
  fieldType: PulseFieldType;
  allowedValues: string[];
  // Aligned to the rows array by index; '' for a blank question.
  values: string[];
};

// Listed as a value so the results route validates against the same set the view renders.
export const PULSE_RUN_STATUSES = ['processing', 'succeeded', 'succeededWithWarnings', 'failed'] as const;

export type PulseRunStatus = typeof PULSE_RUN_STATUSES[number];

// What the process dashboard renders for one run.
export type PulseRunView = {
  id: string;
  status: PulseRunStatus;
  surveyFilename: string;
  modelName: string | null;
  createdAt: string;
  completedAt: string | null;
  rowsInFile: number | null;
  rowsAnalyzed: number | null;
  failedRowCount: number | null;
  // { cause, fix } for failed runs and for completed runs with a warning.
  message: { cause: string; fix: string | null } | null;
  fallbacksByColumn: Array<{ fieldName: string; count: number }>;
  recommendedActions: Array<{ action: string; rationale: string }> | null;
  // null = available; a string = why it isn't.
  outputs: Record<PulseOutputKind, string | null>;
  hasLegacyOutputs: boolean;
};
