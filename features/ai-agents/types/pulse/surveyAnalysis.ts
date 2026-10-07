export enum PulseFieldType {
  CATEGORY = 'category',
  SCALE = 'scale',
  FREE_TEXT = 'freeText',
}

// One generated output column and the user-authored prompt that produces it.
export type PulseFieldConfig = {
  fieldName: string;
  prompt: string;
  fieldType: PulseFieldType;
  allowedValues: string[];
  defaultValue: string | null;
  // Which input columns this field reasons over. Empty means the whole row.
  inputColumnRefs: string[];
  sortOrder: number;
};

export type PulseInputMapping = {
  sheetName: string;
  headerRow: number;
  inputColumns: string[];
};

// One survey header cell: the column it sits in and its question text.
export type PulseSurveyHeader = {
  letter: string;
  header: string;
};

export type SurveyCell = {
  column: string;
  header: string;
  value: string;
};

export type ParsedSurveyRow = {
  rowNumber: number;
  cells: Record<string, SurveyCell>;
  responseText: string;
};

/**
 * One derived cell. An empty `value` with `wasDefaulted: false` is a question this respondent
 * left blank — nothing was asked of the model and nothing failed — so anything reading
 * `wasDefaulted` to mean "not a real answer" has to treat an empty value the same way.
 */
export type PulseExtractedValue = {
  fieldName: string;
  value: string;
  wasDefaulted: boolean;
  failureReason: string | null;
};

export type PulseResultValue = {
  fieldName: string;
  value: string;
  wasDefaulted: boolean;
};

// One question and this respondent's answer to it, kept apart so each can be read on its own.
export type PulseResultCell = {
  header: string;
  value: string;
};

export type PulseResult = {
  id: string;
  rowNumber: number;
  responseText: string;
  // Null for rows stored before the answers were kept apart, which only have responseText.
  cells: PulseResultCell[] | null;
  sortOrder: number;
  values: PulseResultValue[];
};

export type PulseFieldSummary = {
  fieldName: string;
  fieldType: PulseFieldType;
  sortOrder: number;
};

export type PulseJobConfig = PulseInputMapping & {
  persona: string;
  resultsFocus: string | null;
  fields: PulseFieldConfig[];
};

export type PulseDistribution = {
  fieldName: string;
  // `count` is the total for the value; `defaultedCount` is how much of that total
  // fell back to the field's default instead of being derived from a response.
  counts: Array<{ value: string; count: number; defaultedCount: number }>;
};
