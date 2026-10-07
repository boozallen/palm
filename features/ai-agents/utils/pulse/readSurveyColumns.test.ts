import * as ExcelJS from 'exceljs';

import readSurveyColumns from '@/features/ai-agents/utils/pulse/readSurveyColumns';
import readSurveyRows from '@/features/ai-agents/utils/pulse/readSurveyRows';
import type { PulseInputMapping } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const mapping: PulseInputMapping = {
  sheetName: 'Feedback',
  headerRow: 1,
  inputColumns: ['C', 'D'],
};

function buildWorkbook(rows: Array<Array<string | null>>, sheetName = 'Feedback'): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  rows.forEach((row) => sheet.addRow(row));
  return workbook;
}

const survey = buildWorkbook([
  ['Id', 'Region', 'What did you like?', 'What would you change?'],
  ['1', 'East', 'The mentoring', 'Nothing'],
  ['2', 'West', null, null],
  [null, null, null, null],
  ['3', 'East', 'The keynote', null],
]);

describe('readSurveyColumns', () => {
  it('returns every header column in sheet order, not just the analyzed ones', () => {
    const surveyColumns = readSurveyColumns(survey, mapping, readSurveyRows(survey, mapping));

    expect(surveyColumns.map((column) => [column.letter, column.header])).toEqual([
      ['A', 'Id'],
      ['B', 'Region'],
      ['C', 'What did you like?'],
      ['D', 'What would you change?'],
    ]);
  });

  it('lines each value up with the analyzed row it came from', () => {
    const surveyColumns = readSurveyColumns(survey, mapping, readSurveyRows(survey, mapping));

    expect(surveyColumns[0].values).toEqual(['1', '2', '3']);
    expect(surveyColumns[1].values).toEqual(['East', 'West', 'East']);
  });

  it('reads a blank cell as an empty string', () => {
    const surveyColumns = readSurveyColumns(survey, mapping, readSurveyRows(survey, mapping));

    expect(surveyColumns[3].values).toEqual(['Nothing', '', '']);
  });

  it('reads a header row below the first row', () => {
    const titled = buildWorkbook([
      ['Symposium feedback', null, null, null],
      ['Id', 'Region', 'What did you like?', 'What would you change?'],
      ['1', 'East', 'The mentoring', null],
      ['2', 'West', null, null],
    ]);
    const lowered = { ...mapping, headerRow: 2 };

    const surveyColumns = readSurveyColumns(titled, lowered, readSurveyRows(titled, lowered));

    expect(surveyColumns.map((column) => column.header)).toEqual([
      'Id',
      'Region',
      'What did you like?',
      'What would you change?',
    ]);
    expect(surveyColumns[0].values).toEqual(['1', '2']);
  });

  it('returns nothing for a worksheet that is not in the workbook', () => {
    expect(readSurveyColumns(survey, { ...mapping, sheetName: 'Missing' }, [])).toEqual([]);
  });
});
