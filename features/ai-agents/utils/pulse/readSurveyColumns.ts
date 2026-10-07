import * as ExcelJS from 'exceljs';

import {
  cellToString,
  columnLetterToIndex,
  readHeaderColumns,
} from '@/features/ai-agents/utils/pulse/readSurveyRows';
import type {
  ParsedSurveyRow,
  PulseInputMapping,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type { PulseSurveyColumn } from '@/features/ai-agents/types/pulse/results';

/**
 * Every header column's values for the analyzed rows, aligned to `rows` by index.
 */
export default function readSurveyColumns(
  workbook: ExcelJS.Workbook,
  mapping: PulseInputMapping,
  rows: ParsedSurveyRow[],
): PulseSurveyColumn[] {
  const sheet = workbook.getWorksheet(mapping.sheetName);
  if (!sheet) {
    return [];
  }

  const letters = readHeaderColumns(workbook, mapping.sheetName, mapping.headerRow);
  const readCell = (rowNumber: number, letter: string): string =>
    cellToString(sheet.getRow(rowNumber).getCell(columnLetterToIndex(letter)).value).trim();

  return letters.map((letter) => ({
    letter,
    header: readCell(mapping.headerRow, letter),
    values: rows.map((row) => readCell(row.rowNumber, letter)),
  }));
}
