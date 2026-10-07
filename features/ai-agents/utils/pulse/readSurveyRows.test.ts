import * as ExcelJS from 'exceljs';

import readSurveyRows, {
  readHeaderCells,
  readHeaderColumns,
  toResultCells,
} from '@/features/ai-agents/utils/pulse/readSurveyRows';
import {
  formatPulseError,
  noAnsweredRowsError,
  worksheetMissingError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { PulseInputMapping } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const mapping: PulseInputMapping = {
  sheetName: 'Feedback',
  headerRow: 1,
  inputColumns: ['B', 'C'],
};

function buildWorkbook(rows: Array<Array<string | null>>, sheetName = 'Feedback'): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  rows.forEach((row) => sheet.addRow(row));
  return workbook;
}

describe('readSurveyRows', () => {
  it('reads one row per respondent', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
      ['2', 'Helpful resources', 'Shorter'],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows).toHaveLength(2);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].rowNumber).toBe(3);
  });

  it('labels each mapped cell with its column header', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows[0].cells['B']).toEqual({
      column: 'B',
      header: 'What did you like?',
      value: 'The advice column',
    });
  });

  it('concatenates mapped columns under their headers as the response text', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows[0].responseText).toBe('What did you like?:\nThe advice column\n\nWhat would you change?:\nNothing');
  });

  it('keeps a paragraph break inside one answer from reading as another question', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'Week one was rough.\n\nUpdate:\nIt got better.', 'Nothing'],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows[0].responseText).toBe(
      'What did you like?:\nWeek one was rough.\nUpdate:\nIt got better.\n\nWhat would you change?:\nNothing',
    );
  });

  it('keeps a question the respondent skipped from swallowing the answers after it', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', '', 'Nothing'],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows[0].responseText).toBe(
      'What did you like?:\n\nWhat would you change?:\nNothing',
    );
  });

  it('keeps a respondent who left every mapped column blank', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
      ['2', null, null],
      ['3', 'Helpful resources', ''],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3, 4]);
    expect(rows[1].cells['B'].value).toBe('');
  });

  it('skips a row with nothing in any header column', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
      [null, null, null],
      ['3', 'Helpful resources', ''],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows.map((r) => r.rowNumber)).toEqual([2, 4]);
  });

  it('skips a row whose only data sits outside the header columns', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
      [null, null, null, 'A stray note'],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows.map((r) => r.rowNumber)).toEqual([2]);
  });

  it('keeps a row when only some mapped columns are blank', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', null],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(rows).toHaveLength(1);
    expect(rows[0].cells['C'].value).toBe('');
  });

  it('honours a header row below the first row', () => {
    const workbook = buildWorkbook([
      ['Survey export', null, null],
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
    ]);

    const rows = readSurveyRows(workbook, { ...mapping, headerRow: 2 });

    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(3);
    expect(rows[0].cells['B'].header).toBe('What did you like?');
  });

  it('falls back to the column letter when a header cell is blank', () => {
    const workbook = buildWorkbook([
      ['Id', null, 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
    ]);

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].header).toBe('Column B');
  });

  it('reads rich text cells as plain text', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'What did you like?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { richText: [{ text: 'The ' }, { text: 'advice column' }] };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe('The advice column');
  });

  it('reads a formula cell as the value the spreadsheet calculated', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'What did you like?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { formula: 'CONCATENATE(A2," column")', result: 'The advice column' };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe('The advice column');
  });

  it('reads a filled-down formula cell as the value the spreadsheet calculated', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'What did you like?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { sharedFormula: 'B1', result: 'The advice column' };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe('The advice column');
  });

  it('reads a numeric formula result as its number', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'How many sessions?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { formula: 'SUM(D2:E2)', result: 4 };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe('4');
  });

  it('reads a date formula result the same way as a plain date', () => {
    const attended = new Date('2026-09-14T12:00:00Z');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'When did you attend?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { formula: 'TODAY()', result: attended };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe(attended.toISOString());
  });

  it('reads a formula that errored as an empty answer', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'How many sessions?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { formula: 'A2/0', result: { error: '#DIV/0!' } };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe('');
  });

  it('reads an error cell as an empty answer', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'What did you like?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { error: '#REF!' };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe('');
  });

  it('reads a link cell as the text it displays', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.addRow(['Id', 'What did you like?', 'What would you change?']);
    const row = sheet.addRow(['1', null, 'Nothing']);
    row.getCell(2).value = { text: 'The advice column', hyperlink: 'https://example.com/advice' };

    expect(readSurveyRows(workbook, mapping)[0].cells['B'].value).toBe('The advice column');
  });

  it('throws when the configured worksheet does not exist', () => {
    const workbook = buildWorkbook([['Id', 'A', 'B'], ['1', 'x', 'y']], 'Charts');

    expect(() => readSurveyRows(workbook, mapping)).toThrow(
      formatPulseError(worksheetMissingError('Feedback')),
    );
  });

  it('throws when the mapping resolves to zero rows', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
    ]);

    expect(() => readSurveyRows(workbook, mapping)).toThrow(
      formatPulseError(noAnsweredRowsError(['B', 'C'])),
    );
  });

  it('throws when no respondent answered any mapped column', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', null, null],
      ['2', '', null],
    ]);

    expect(() => readSurveyRows(workbook, mapping)).toThrow(
      formatPulseError(noAnsweredRowsError(['B', 'C'])),
    );
  });
});

describe('readHeaderColumns', () => {
  it('returns a letter for every column that has a header', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The keynote', 'Shorter breaks'],
    ]);

    expect(readHeaderColumns(workbook, 'Feedback', 1)).toEqual(['A', 'B', 'C']);
  });

  it('skips a column whose header cell is empty', () => {
    const workbook = buildWorkbook([
      ['Id', null, 'What would you change?'],
      ['1', 'ignored', 'Shorter breaks'],
    ]);

    expect(readHeaderColumns(workbook, 'Feedback', 1)).toEqual(['A', 'C']);
  });

  it('reads the header row the caller names, not the first row', () => {
    const workbook = buildWorkbook([
      ['Symposium feedback export'],
      ['Id', 'What did you like?'],
      ['1', 'The keynote'],
    ]);

    expect(readHeaderColumns(workbook, 'Feedback', 2)).toEqual(['A', 'B']);
  });

  it('names columns past Z with two letters', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    const header = sheet.getRow(1);
    header.getCell(27).value = 'Question 27';
    header.getCell(28).value = 'Question 28';
    header.commit();

    expect(readHeaderColumns(workbook, 'Feedback', 1)).toEqual(['AA', 'AB']);
  });

  it('returns nothing when the named worksheet does not exist', () => {
    const workbook = buildWorkbook([['Id', 'What did you like?']]);

    expect(readHeaderColumns(workbook, 'Missing', 1)).toEqual([]);
  });
});

describe('readHeaderCells', () => {
  it('pairs every header cell that has text with its column letter', () => {
    const workbook = buildWorkbook([
      ['Id', null, '  What would you change? '],
      ['1', 'ignored', 'Shorter breaks'],
    ]);

    expect(readHeaderCells(workbook, 'Feedback', 1)).toEqual([
      { letter: 'A', header: 'Id' },
      { letter: 'C', header: 'What would you change?' },
    ]);
  });

  it('returns nothing when the named worksheet does not exist', () => {
    const workbook = buildWorkbook([['Id', 'What did you like?']]);

    expect(readHeaderCells(workbook, 'Missing', 1)).toEqual([]);
  });
});

describe('toResultCells', () => {
  it('pairs every question with this respondent\'s answer, in the order they were read', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', 'Nothing'],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(toResultCells(rows[0].cells)).toEqual([
      { header: 'What did you like?', value: 'The advice column' },
      { header: 'What would you change?', value: 'Nothing' },
    ]);
  });

  it('keeps a skipped question, with nothing under it', () => {
    const workbook = buildWorkbook([
      ['Id', 'What did you like?', 'What would you change?'],
      ['1', 'The advice column', null],
    ]);

    const rows = readSurveyRows(workbook, mapping);

    expect(toResultCells(rows[0].cells)[1]).toEqual({ header: 'What would you change?', value: '' });
  });
});
