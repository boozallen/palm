import * as ExcelJS from 'exceljs';

import type {
  ParsedSurveyRow,
  PulseInputMapping,
  PulseResultCell,
  PulseSurveyHeader,
  SurveyCell,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';
import {
  noAnsweredRowsError,
  PulseUserError,
  worksheetMissingError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

export const SURVEY_READ_ERROR = 'Failed to read the survey workbook. Please ensure it is a valid .xlsx file.';

export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText.map((rt) => rt.text).join('');
    }
    // A formula cell holds the value Excel last calculated, a link cell its display text.
    if ('formula' in value || 'sharedFormula' in value) {
      return cellToString(value.result ?? null);
    }
    if ('hyperlink' in value) {
      return cellToString(value.text);
    }
    // A spreadsheet error has no text worth sending to a model, so the cell reads as empty
    // and whatever needed it reports the gap instead.
    if ('error' in value) {
      return '';
    }
  }
  return String(value).trim();
}

export function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (const char of letter.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
}

function indexToColumnLetter(index: number): string {
  let letters = '';
  let remaining = index;

  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return letters;
}

/**
 * One block per question, blocks separated by a blank line. A respondent's own blank lines are
 * collapsed to single ones first, and a question they skipped carries its header alone, so the
 * blank line is always a question boundary and never appears inside or beside a block.
 */
export function buildResponseText(cells: SurveyCell[]): string {
  return cells
    .map((cell) => {
      const value = cell.value.replace(/\n\s*\n+/g, '\n');

      return value.length > 0 ? `${cell.header}:\n${value}` : `${cell.header}:`;
    })
    .join('\n\n');
}

/**
 * The row's answers for storage, one per question. The cells were read in the order the mapping
 * names its columns, which is the order the response text puts them in.
 */
export function toResultCells(cells: Record<string, SurveyCell>): PulseResultCell[] {
  return Object.values(cells).map((cell) => ({ header: cell.header, value: cell.value }));
}

/**
 * Every header cell that has text, with its column letter, which is the set of columns a
 * prompt matrix is allowed to name. Silent on a missing sheet so layout detection
 * can report the workbook's real problem instead.
 */
export function readHeaderCells(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headerRow: number,
): PulseSurveyHeader[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    return [];
  }

  const headers: PulseSurveyHeader[] = [];

  sheet.getRow(headerRow).eachCell((cell, colNumber) => {
    const header = cellToString(cell.value);

    if (header.length > 0) {
      headers.push({ letter: indexToColumnLetter(colNumber), header });
    }
  });

  return headers;
}

export function readHeaderColumns(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headerRow: number,
): string[] {
  return readHeaderCells(workbook, sheetName, headerRow).map((cell) => cell.letter);
}

export function readSurveyHeaders(
  workbook: ExcelJS.Workbook,
  mapping: PulseInputMapping,
): SurveyCell[] {
  const sheet = workbook.getWorksheet(mapping.sheetName);
  if (!sheet) {
    throw PulseUserError.from(worksheetMissingError(mapping.sheetName));
  }

  const headerRow = sheet.getRow(mapping.headerRow);

  return mapping.inputColumns.map((column) => {
    const header = cellToString(headerRow.getCell(columnLetterToIndex(column)).value);
    return { column, header: header || `Column ${column}`, value: '' };
  });
}

/**
 * Reads every respondent row out of a loaded workbook: any row with data under a header,
 * even one that left every mapped column blank, so every respondent stays in the counts.
 *
 * Shared deliberately between the client-side upload preview and the worker so
 * the rows a user previews are exactly the rows that get processed.
 */
export default function readSurveyRows(
  workbook: ExcelJS.Workbook,
  mapping: PulseInputMapping,
): ParsedSurveyRow[] {
  const sheet = workbook.getWorksheet(mapping.sheetName);
  if (!sheet) {
    throw PulseUserError.from(worksheetMissingError(mapping.sheetName));
  }

  const headers = readSurveyHeaders(workbook, mapping);
  const dataColumns = Array.from(new Set([
    ...readHeaderColumns(workbook, mapping.sheetName, mapping.headerRow),
    ...mapping.inputColumns,
  ]));

  const rows: ParsedSurveyRow[] = [];
  let hasAnyAnswer = false;

  for (let rowNumber = mapping.headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const sheetRow = sheet.getRow(rowNumber);
    const readCell = (column: string) => cellToString(sheetRow.getCell(columnLetterToIndex(column)).value);

    if (dataColumns.every((column) => readCell(column).length === 0)) {
      continue;
    }

    const cells: Record<string, SurveyCell> = {};
    const ordered: SurveyCell[] = [];

    for (const header of headers) {
      const cell: SurveyCell = { column: header.column, header: header.header, value: readCell(header.column) };
      cells[header.column] = cell;
      ordered.push(cell);
    }

    hasAnyAnswer = hasAnyAnswer || ordered.some((cell) => cell.value.length > 0);

    rows.push({
      rowNumber,
      cells,
      responseText: buildResponseText(ordered),
    });
  }

  if (!hasAnyAnswer) {
    throw PulseUserError.from(noAnsweredRowsError(mapping.inputColumns));
  }

  return rows;
}
