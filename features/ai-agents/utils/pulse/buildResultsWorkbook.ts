import * as ExcelJS from 'exceljs';

import type { PulseResult, PulseFieldSummary } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const SPREADSHEET_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const RESULTS_SHEET_NAME = 'PULSE Results';

export const MODEL_INPUT_SHEET_NAME = 'Model input';

const MODEL_INPUT_NOTE = 'What the model read for each row, one column per survey question. An empty cell is a question the respondent skipped.';

const LEGACY_MODEL_INPUT_NOTE = 'What the model read for each row, one question per block. This run was processed before the answers were kept apart, so they are not split into columns.';

const QUESTION_COLUMN_WIDTH = 40;

type BuildResultsWorkbookParams = {
  results: PulseResult[];
  fields: PulseFieldSummary[];
  surveyFilename: string;
};

function styleSheet(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
  });

  sheet.eachRow((row) => {
    row.alignment = { wrapText: true, vertical: 'top' };
  });
}

export default async function buildResultsWorkbook({
  results,
  fields,
  surveyFilename,
}: BuildResultsWorkbookParams): Promise<Blob> {
  const orderedFields = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
  const orderedResults = [...results].sort((a, b) => a.rowNumber - b.rowNumber);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PULSE';
  const sheet = workbook.addWorksheet(RESULTS_SHEET_NAME);

  sheet.columns = [
    { header: 'Row', key: 'rowNumber', width: 8 },
    ...orderedFields.map((field) => ({ header: field.fieldName, key: `field:${field.fieldName}`, width: 24 })),
  ];

  orderedResults.forEach((result) => {
    const byName = new Map(result.values.map((value) => [value.fieldName, value]));

    const row: Record<string, string | number> = { rowNumber: result.rowNumber };

    orderedFields.forEach((field) => {
      row[`field:${field.fieldName}`] = byName.get(field.fieldName)?.value ?? '';
    });

    sheet.addRow(row);
  });

  /**
   * The model's input lives on its own sheet, joined back by row number: it is what makes a
   * derived value checkable, and it is far too wide to read beside the values it produced.
   */
  const inputSheet = workbook.addWorksheet(MODEL_INPUT_SHEET_NAME);

  /**
   * Every row of a run was read from the same questions, so one row's questions are the whole
   * header. Null where any row predates them, which leaves the run its single joined-up column.
   */
  const questions = orderedResults.length > 0
    && orderedResults.every((result) => result.cells !== null && result.cells.length > 0)
    ? orderedResults[0]?.cells ?? null
    : null;

  inputSheet.columns = questions === null
    ? [
      { header: 'Row', key: 'rowNumber', width: 8 },
      { header: 'Response', key: 'responseText', width: 70 },
    ]
    : [
      { header: 'Row', key: 'rowNumber', width: 8 },
      ...questions.map((question, index) => ({
        header: question.header,
        key: `cell:${index}`,
        width: QUESTION_COLUMN_WIDTH,
      })),
    ];

  orderedResults.forEach((result) => {
    if (questions === null) {
      inputSheet.addRow({ rowNumber: result.rowNumber, responseText: result.responseText });
      return;
    }

    const row: Record<string, string | number> = { rowNumber: result.rowNumber };

    // Keyed by position rather than by header, because two questions can read the same.
    for (const [index] of questions.entries()) {
      row[`cell:${index}`] = result.cells?.[index]?.value ?? '';
    }

    inputSheet.addRow(row);
  });

  styleSheet(sheet);
  styleSheet(inputSheet);

  // The filename is metadata only - the caller names the download.
  sheet.getCell('A1').note = `Derived from ${surveyFilename}`;
  inputSheet.getCell('A1').note = questions === null ? LEGACY_MODEL_INPUT_NOTE : MODEL_INPUT_NOTE;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: SPREADSHEET_CONTENT_TYPE });
}
