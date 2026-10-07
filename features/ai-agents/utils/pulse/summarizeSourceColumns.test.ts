import summarizeSourceColumns from './summarizeSourceColumns';
import type { ParsedSurveyRow, SurveyCell } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const headers: SurveyCell[] = [
  { column: 'B', header: 'What did you like?', value: '' },
  { column: 'C', header: 'How often do you read it?', value: '' },
];

function rowWith(rowNumber: number, like: string, often: string): ParsedSurveyRow {
  return {
    rowNumber,
    cells: {
      B: { column: 'B', header: 'What did you like?', value: like },
      C: { column: 'C', header: 'How often do you read it?', value: often },
    },
    responseText: '',
  };
}

const rows = [
  rowWith(2, 'The advice column', 'Every month'),
  rowWith(3, '', 'Sometimes'),
  rowWith(4, '   ', 'Never'),
  rowWith(5, '', 'Every month'),
];

describe('summarizeSourceColumns', () => {
  it('names the question each source column points at', () => {
    expect(summarizeSourceColumns(['C'], headers, rows)).toEqual([
      { column: 'C', header: 'How often do you read it?', answered: 4, total: 4, isSparse: false },
    ]);
  });

  it('reports a column most responses left blank', () => {
    const [summary] = summarizeSourceColumns(['B'], headers, rows);

    expect(summary).toMatchObject({ answered: 1, total: 4, isSparse: true });
  });

  it('counts a whitespace-only answer as unanswered', () => {
    const [summary] = summarizeSourceColumns(['B'], headers, [rowWith(2, '  ', 'Never')]);

    expect(summary.answered).toBe(0);
  });

  it('leaves a column the survey has no question for unnamed', () => {
    const [summary] = summarizeSourceColumns(['Z'], headers, rows);

    expect(summary).toMatchObject({ column: 'Z', header: null, answered: 0 });
  });

  it('reports nothing as sparse before a survey has been read', () => {
    expect(summarizeSourceColumns(['B'], [], [])).toEqual([
      { column: 'B', header: null, answered: 0, total: 0, isSparse: false },
    ]);
  });

  it('summarizes every column in the order it was given', () => {
    expect(summarizeSourceColumns(['C', 'B'], headers, rows).map((s) => s.column)).toEqual(['C', 'B']);
  });
});
