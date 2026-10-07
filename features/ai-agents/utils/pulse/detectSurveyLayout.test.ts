import * as ExcelJS from 'exceljs';

import detectSurveyLayout from '@/features/ai-agents/utils/pulse/detectSurveyLayout';
import {
  formatPulseError,
  headerRowEmptyError,
  surveyUnreadableError,
  worksheetMissingError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

type SheetSpec = { name: string; rows: Array<Array<string | null>> };

async function buildFile(sheets: SheetSpec[]): Promise<File> {
  const workbook = new ExcelJS.Workbook();

  sheets.forEach((spec) => {
    const sheet = workbook.addWorksheet(spec.name);
    spec.rows.forEach((row) => sheet.addRow(row));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { arrayBuffer: async () => buffer } as unknown as File;
}

const SURVEY_ROWS: Array<Array<string | null>> = [
  ['Id', 'What did you like?', 'What would you change?'],
  ['1', 'The keynote', 'Shorter breaks'],
  ['2', 'The workshops', 'Nothing'],
];

describe('detectSurveyLayout', () => {
  it('reads the worksheet, header row, and columns off the upload', async () => {
    const file = await buildFile([{ name: 'Sheet1', rows: SURVEY_ROWS }]);

    expect(await detectSurveyLayout(file)).toEqual({
      sheetName: 'Sheet1',
      headerRow: 1,
      columns: ['A', 'B', 'C'],
      headers: [
        { letter: 'A', header: 'Id' },
        { letter: 'B', header: 'What did you like?' },
        { letter: 'C', header: 'What would you change?' },
      ],
      sheetNames: ['Sheet1'],
    });
  });

  it('finds a header row under a title row', async () => {
    const file = await buildFile([{
      name: 'Sheet1',
      rows: [['Symposium feedback export', null, null], ...SURVEY_ROWS],
    }]);

    const layout = await detectSurveyLayout(file);

    expect(layout.headerRow).toBe(2);
    expect(layout.columns).toEqual(['A', 'B', 'C']);
  });

  it('picks the first worksheet holding data over an empty one', async () => {
    const file = await buildFile([
      { name: 'Cover', rows: [] },
      { name: 'Responses', rows: SURVEY_ROWS },
    ]);

    const layout = await detectSurveyLayout(file);

    expect(layout.sheetName).toBe('Responses');
    expect(layout.sheetNames).toEqual(['Cover', 'Responses']);
  });

  it('skips a cover sheet of notes in favour of the sheet holding the responses', async () => {
    const file = await buildFile([
      { name: 'Cover', rows: [['Symposium feedback export'], ['Prepared by Jane'], ['June 2026']] },
      { name: 'Responses', rows: SURVEY_ROWS },
    ]);

    const layout = await detectSurveyLayout(file);

    expect(layout.sheetName).toBe('Responses');
    expect(layout.columns).toEqual(['A', 'B', 'C']);
  });

  it('still reads a survey of a single question when no sheet looks tabular', async () => {
    const file = await buildFile([{ name: 'Sheet1', rows: [['Comments'], ['Great']] }]);

    const layout = await detectSurveyLayout(file);

    expect(layout.sheetName).toBe('Sheet1');
    expect(layout.columns).toEqual(['A']);
  });

  it('reads the worksheet the caller names instead of detecting one', async () => {
    const file = await buildFile([
      { name: 'Responses', rows: SURVEY_ROWS },
      { name: 'Round two', rows: [['Ref', 'Comments'], ['9', 'Great']] },
    ]);

    const layout = await detectSurveyLayout(file, 'Round two');

    expect(layout.sheetName).toBe('Round two');
    expect(layout.columns).toEqual(['A', 'B']);
  });

  it('detects a header row per worksheet rather than reusing the first', async () => {
    const file = await buildFile([
      { name: 'Responses', rows: SURVEY_ROWS },
      { name: 'Round two', rows: [['Export', null], ['Ref', 'Comments'], ['9', 'Great']] },
    ]);

    expect((await detectSurveyLayout(file, 'Round two')).headerRow).toBe(2);
  });

  it('finds the header row of a survey that has no responses in it yet', async () => {
    const file = await buildFile([{
      name: 'Sheet1',
      rows: [['Symposium feedback export', null, null], ['Id', 'What did you like?', 'Change?']],
    }]);

    const layout = await detectSurveyLayout(file);

    expect(layout.headerRow).toBe(2);
    expect(layout.columns).toEqual(['A', 'B', 'C']);
  });

  it('treats the only filled row as the header when nothing follows it', async () => {
    const file = await buildFile([{ name: 'Sheet1', rows: [['Id', 'Comments']] }]);

    expect((await detectSurveyLayout(file)).headerRow).toBe(1);
  });

  it('rejects a workbook it cannot read', async () => {
    const file = { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;

    await expect(detectSurveyLayout(file)).rejects.toThrow(formatPulseError(surveyUnreadableError()));
  });

  it('rejects a workbook with no data on any worksheet', async () => {
    const file = await buildFile([{ name: 'Cover', rows: [] }]);

    await expect(detectSurveyLayout(file)).rejects.toThrow(
      'This workbook has no worksheet with any data.',
    );
  });

  it('rejects a named worksheet with no column headers instead of returning no columns', async () => {
    const file = await buildFile([
      { name: 'Responses', rows: SURVEY_ROWS },
      { name: 'Notes', rows: [] },
    ]);

    await expect(detectSurveyLayout(file, 'Notes')).rejects.toThrow(
      formatPulseError(headerRowEmptyError(1, 'Notes')),
    );
  });

  it('rejects a worksheet name the workbook does not have', async () => {
    const file = await buildFile([{ name: 'Sheet1', rows: SURVEY_ROWS }]);

    await expect(detectSurveyLayout(file, 'Missing')).rejects.toThrow(
      formatPulseError(worksheetMissingError('Missing')),
    );
  });
});
