import type { ParsedSurveyRow, SurveyCell } from '@/features/ai-agents/types/pulse/surveyAnalysis';

// Below this, a column is reported as one most respondents left blank.
export const LOW_ANSWER_RATE = 0.5;

export type SourceColumnSummary = {
  column: string;
  header: string | null;
  answered: number;
  total: number;
  isSparse: boolean;
};

/**
 * Joins the source columns a matrix row names to the survey that was actually uploaded: the
 * question each letter points at, and how many responses answered it. A letter with no header
 * resolves to a null header, which is what a matrix written against a different export looks like.
 */
export default function summarizeSourceColumns(
  columns: string[],
  headers: SurveyCell[],
  rows: ParsedSurveyRow[],
): SourceColumnSummary[] {
  return columns.map((column) => {
    const header = headers.find((candidate) => candidate.column === column);
    const answered = rows.filter(
      (row) => (row.cells[column]?.value ?? '').trim().length > 0,
    ).length;

    return {
      column,
      header: header ? header.header : null,
      answered,
      total: rows.length,
      isSparse: rows.length > 0 && answered / rows.length < LOW_ANSWER_RATE,
    };
  });
}
