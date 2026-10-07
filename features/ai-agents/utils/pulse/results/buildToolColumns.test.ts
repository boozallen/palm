import buildToolColumns from '@/features/ai-agents/utils/pulse/results/buildToolColumns';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import {
  PulseFieldType,
  type ParsedSurveyRow,
  type PulseFieldConfig,
  type PulseResult,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

const sentiment: PulseFieldConfig = {
  fieldName: 'Sentiment',
  prompt: 'Judge sentiment.',
  fieldType: PulseFieldType.CATEGORY,
  allowedValues: ['Positive', 'Neutral'],
  defaultValue: MATRIX_FALLBACK_VALUE,
  inputColumnRefs: [],
  sortOrder: 1,
};

const takeaway: PulseFieldConfig = {
  fieldName: 'Takeaway',
  prompt: 'Summarize the response.',
  fieldType: PulseFieldType.FREE_TEXT,
  allowedValues: [],
  defaultValue: MATRIX_FALLBACK_VALUE,
  inputColumnRefs: [],
  sortOrder: 0,
};

function row(rowNumber: number): ParsedSurveyRow {
  return { rowNumber, cells: {}, responseText: `Answer ${rowNumber}` };
}

function result(rowNumber: number, sortOrder: number, sentimentValue: string): PulseResult {
  return {
    id: `result-${rowNumber}`,
    rowNumber,
    responseText: `Answer ${rowNumber}`,
    cells: [{ header: 'Question', value: `Answer ${rowNumber}` }],
    sortOrder,
    values: [
      { fieldName: 'Sentiment', value: sentimentValue, wasDefaulted: false },
      { fieldName: 'Takeaway', value: `Takeaway ${rowNumber}`, wasDefaulted: false },
    ],
  };
}

describe('buildToolColumns', () => {
  it('lines each saved value up with its survey row, whatever order it was saved in', () => {
    const columns = buildToolColumns(
      [sentiment],
      [row(2), row(3)],
      [result(3, 1, 'Neutral'), result(2, 0, 'Positive')],
    );

    expect(columns[0].values).toEqual(['Positive', 'Neutral']);
  });

  it('leaves a row with no saved value blank', () => {
    const columns = buildToolColumns([sentiment], [row(2), row(3)], [result(2, 0, 'Positive')]);

    expect(columns[0].values).toEqual(['Positive', '']);
  });

  it('lists the tool columns in matrix order', () => {
    const columns = buildToolColumns([sentiment, takeaway], [row(2)], [result(2, 0, 'Positive')]);

    expect(columns.map((column) => column.fieldName)).toEqual(['Takeaway', 'Sentiment']);
  });

  it('carries each column type and allowed values for profiling', () => {
    const [column] = buildToolColumns([sentiment], [row(2)], [result(2, 0, 'Positive')]);

    expect(column).toEqual({
      fieldName: 'Sentiment',
      fieldType: PulseFieldType.CATEGORY,
      allowedValues: ['Positive', 'Neutral'],
      values: ['Positive'],
    });
  });
});
