import * as ExcelJS from 'exceljs';

import loadWorkbook from '@/features/ai-agents/utils/pulse/loadWorkbook';
import { readHeaderCells } from '@/features/ai-agents/utils/pulse/readSurveyRows';
import {
  PulseUserError,
  headerRowEmptyError,
  surveyUnreadableError,
  worksheetMissingError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { PulseSurveyHeader } from '@/features/ai-agents/types/pulse/surveyAnalysis';

export type SurveyLayout = {
  sheetName: string;
  headerRow: number;
  columns: string[];
  // The same columns with their header text, so a matrix can name a column by its question.
  headers: PulseSurveyHeader[];
  sheetNames: string[];
};

const HEADER_SCAN_ROWS = 10;

// Without headers there are no columns to pick, so the picker would come up empty with no reason why.
function readHeaders(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headerRow: number,
): PulseSurveyHeader[] {
  const headers = readHeaderCells(workbook, sheetName, headerRow);

  if (headers.length === 0) {
    throw PulseUserError.from(headerRowEmptyError(headerRow, sheetName));
  }

  return headers;
}

function filledCellCount(row: ExcelJS.Row): number {
  let filled = 0;

  row.eachCell((cell) => {
    const value = cell.value;
    const text = value === null || value === undefined ? '' : String(value).trim();

    if (text.length > 0) {
      filled += 1;
    }
  });

  return filled;
}

/**
 * The row that names the questions: the fullest of the first few rows, so a title or
 * instruction block above the real header is skipped. Ties go to the earliest row, and a
 * sheet with nothing usable falls back to row 1.
 */
function detectHeaderRow(sheet: ExcelJS.Worksheet): number {
  let bestRow = 0;
  let bestCount = 0;

  const lastRow = Math.min(HEADER_SCAN_ROWS, sheet.rowCount);

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber++) {
    const count = filledCellCount(sheet.getRow(rowNumber));

    if (count > bestCount) {
      bestRow = rowNumber;
      bestCount = count;
    }
  }

  return bestRow === 0 ? 1 : bestRow;
}

/**
 * Whether a worksheet reads like a table of responses rather than a cover or notes page:
 * its header row names more than one thing, and there is at least one row under it.
 */
function looksTabular(sheet: ExcelJS.Worksheet): boolean {
  const headerRow = detectHeaderRow(sheet);

  return filledCellCount(sheet.getRow(headerRow)) > 1 && sheet.rowCount > headerRow;
}

// The first worksheet that reads like a table, so a cover page with a title cell does not
// get parsed as the survey. A workbook with nothing tabular falls back to its first content.
function pickSurveySheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const withContent = workbook.worksheets.filter((candidate) => candidate.actualRowCount > 0);

  return withContent.find(looksTabular) ?? withContent[0];
}

/**
 * Reads the worksheet, header row, and column letters straight off an upload so the user
 * does not have to describe their own file. A worksheet name narrows the read to that
 * sheet, for the workbooks where more than one sheet holds data.
 */
export default async function detectSurveyLayout(
  file: File,
  sheetNameOverride?: string,
): Promise<SurveyLayout> {
  let workbook: ExcelJS.Workbook;

  try {
    workbook = await loadWorkbook(await file.arrayBuffer());
  } catch {
    throw PulseUserError.from(surveyUnreadableError());
  }

  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);

  if (sheetNameOverride !== undefined) {
    const named = workbook.getWorksheet(sheetNameOverride);

    if (!named) {
      throw PulseUserError.from(worksheetMissingError(sheetNameOverride));
    }

    const headerRow = detectHeaderRow(named);
    const headers = readHeaders(workbook, named.name, headerRow);

    return {
      sheetName: named.name,
      headerRow,
      columns: headers.map((cell) => cell.letter),
      headers,
      sheetNames,
    };
  }

  const sheet = pickSurveySheet(workbook);

  if (!sheet) {
    throw new Error('This workbook has no worksheet with any data.');
  }

  const headerRow = detectHeaderRow(sheet);
  const headers = readHeaders(workbook, sheet.name, headerRow);

  return {
    sheetName: sheet.name,
    headerRow,
    columns: headers.map((cell) => cell.letter),
    headers,
    sheetNames,
  };
}
