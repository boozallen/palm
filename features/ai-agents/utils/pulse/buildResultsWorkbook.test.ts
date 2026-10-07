import ExcelJS from 'exceljs';

import buildResultsWorkbook, {
  MODEL_INPUT_SHEET_NAME,
  RESULTS_SHEET_NAME,
} from '@/features/ai-agents/utils/pulse/buildResultsWorkbook';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type { PulseResult, PulseFieldSummary } from '@/features/ai-agents/types/pulse/surveyAnalysis';

// Polyfill Blob.arrayBuffer for Jest/jsdom environment
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (this: Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

const fields: PulseFieldSummary[] = [
  { fieldName: 'Sentiment', fieldType: PulseFieldType.CATEGORY, sortOrder: 0 },
  { fieldName: 'Favorite Section', fieldType: PulseFieldType.FREE_TEXT, sortOrder: 1 },
];

const results: PulseResult[] = [
  {
    id: 'r1',
    rowNumber: 2,
    responseText: 'What stood out?:\nThe keynote was the best part of the whole day.\n\nAnything else?:\nMore coffee',
    cells: [
      { header: 'What stood out?', value: 'The keynote was the best part of the whole day.' },
      { header: 'Anything else?', value: 'More coffee' },
    ],
    sortOrder: 0,
    values: [
      { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false },
      { fieldName: 'Favorite Section', value: 'Keynote', wasDefaulted: false },
    ],
  },
  {
    id: 'r2',
    rowNumber: 3,
    responseText: 'What stood out?:\nn/a\n\nAnything else?:',
    cells: [
      { header: 'What stood out?', value: 'n/a' },
      { header: 'Anything else?', value: '' },
    ],
    sortOrder: 1,
    values: [
      { fieldName: 'Sentiment', value: 'Neutral', wasDefaulted: true },
      { fieldName: 'Favorite Section', value: '', wasDefaulted: true },
    ],
  },
];

// A run stored before the answers were kept apart: it only has the joined-up response text.
const legacyResults: PulseResult[] = results.map((result) => ({ ...result, cells: null }));

async function readBack(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe('buildResultsWorkbook', () => {
  it('writes a header row with the row number and one column per field', async () => {
    const workbook = await readBack(await buildResultsWorkbook({ results, fields, surveyFilename: 'symposium.xlsx' }));
    const sheet = workbook.getWorksheet(RESULTS_SHEET_NAME);

    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).values).toEqual([
      undefined,
      'Row',
      'Sentiment',
      'Favorite Section',
    ]);
  });

  // The model's input is what makes a derived value checkable, but it is too wide to read beside it.
  it('keeps what the model read on its own sheet, joined back by row number', async () => {
    const workbook = await readBack(await buildResultsWorkbook({ results, fields, surveyFilename: 'symposium.xlsx' }));
    const sheet = workbook.getWorksheet(RESULTS_SHEET_NAME);
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(sheet?.getRow(1).values).not.toContain('Response');
    expect(inputSheet?.getRow(2).getCell(1).value).toBe(2);
    expect(inputSheet?.getRow(3).getCell(1).value).toBe(3);
  });

  it('gives every survey question its own column, in the order the model read them', async () => {
    const workbook = await readBack(await buildResultsWorkbook({ results, fields, surveyFilename: 'symposium.xlsx' }));
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(inputSheet?.getRow(1).values).toEqual([undefined, 'Row', 'What stood out?', 'Anything else?']);
    expect(inputSheet?.getRow(2).getCell(2).value).toBe('The keynote was the best part of the whole day.');
    expect(inputSheet?.getRow(2).getCell(3).value).toBe('More coffee');
  });

  it('leaves the cell empty for a question the respondent skipped', async () => {
    const workbook = await readBack(await buildResultsWorkbook({ results, fields, surveyFilename: 'symposium.xlsx' }));
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(inputSheet?.getRow(3).getCell(2).value).toBe('n/a');
    expect(inputSheet?.getRow(3).getCell(3).value).toBe('');
  });

  it('keeps two questions apart even when they are worded the same', async () => {
    const sameHeader: PulseResult[] = [{
      ...results[0],
      cells: [
        { header: 'Why?', value: 'The keynote' },
        { header: 'Why?', value: 'The coffee' },
      ],
    }];

    const workbook = await readBack(await buildResultsWorkbook({ results: sameHeader, fields, surveyFilename: 's.xlsx' }));
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(inputSheet?.getRow(2).getCell(2).value).toBe('The keynote');
    expect(inputSheet?.getRow(2).getCell(3).value).toBe('The coffee');
  });

  it('falls back to one joined-up column for a run stored before the answers were kept apart', async () => {
    const workbook = await readBack(await buildResultsWorkbook({
      results: legacyResults,
      fields,
      surveyFilename: 'symposium.xlsx',
    }));
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(inputSheet?.getRow(1).values).toEqual([undefined, 'Row', 'Response']);
    expect(inputSheet?.getRow(2).getCell(2).value).toBe(legacyResults[0].responseText);
  });

  it('falls back to one joined-up column when only some rows were kept apart', async () => {
    const mixed: PulseResult[] = [results[0], { ...results[1], cells: null }];

    const workbook = await readBack(await buildResultsWorkbook({ results: mixed, fields, surveyFilename: 's.xlsx' }));
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(inputSheet?.getRow(1).values).toEqual([undefined, 'Row', 'Response']);
    expect(inputSheet?.getRow(2).getCell(2).value).toBe(results[0].responseText);
  });

  it('writes one data row per result in row-number order', async () => {
    const workbook = await readBack(await buildResultsWorkbook({ results, fields, surveyFilename: 'symposium.xlsx' }));
    const sheet = workbook.getWorksheet(RESULTS_SHEET_NAME);

    expect(sheet?.getRow(2).getCell(1).value).toBe(2);
    expect(sheet?.getRow(2).getCell(2).value).toBe('Positive');
    expect(sheet?.getRow(3).getCell(1).value).toBe(3);
    expect(sheet?.getRow(3).getCell(2).value).toBe('Neutral');
  });

  it('leaves a cell blank when the row has no value for a configured field', async () => {
    const sparse: PulseResult[] = [{
      id: 'r3',
      rowNumber: 4,
      responseText: 'partial',
      cells: [{ header: 'What stood out?', value: 'partial' }],
      sortOrder: 0,
      values: [{ fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false }],
    }];

    const workbook = await readBack(await buildResultsWorkbook({ results: sparse, fields, surveyFilename: 's.xlsx' }));
    const sheet = workbook.getWorksheet(RESULTS_SHEET_NAME);

    expect(sheet?.getRow(2).getCell(3).value).toBe('');
  });

  it('orders the field columns by sortOrder, not by the order values happen to arrive in', async () => {
    const reversed: PulseFieldSummary[] = [
      { fieldName: 'Favorite Section', fieldType: PulseFieldType.FREE_TEXT, sortOrder: 1 },
      { fieldName: 'Sentiment', fieldType: PulseFieldType.CATEGORY, sortOrder: 0 },
    ];

    const workbook = await readBack(await buildResultsWorkbook({ results, fields: reversed, surveyFilename: 's.xlsx' }));
    const sheet = workbook.getWorksheet(RESULTS_SHEET_NAME);

    expect(sheet?.getRow(1).getCell(2).value).toBe('Sentiment');
    expect(sheet?.getRow(1).getCell(3).value).toBe('Favorite Section');
  });

  it('puts each value under its own header when a row reports them out of order', async () => {
    const misordered: PulseResult[] = [{
      id: 'r1',
      rowNumber: 2,
      responseText: 'out of order',
      cells: [{ header: 'What stood out?', value: 'out of order' }],
      sortOrder: 0,
      values: [
        { fieldName: 'Favorite Section', value: 'Keynote', wasDefaulted: true },
        { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: true },
      ],
    }];

    const workbook = await readBack(await buildResultsWorkbook({ results: misordered, fields, surveyFilename: 's.xlsx' }));
    const sheet = workbook.getWorksheet(RESULTS_SHEET_NAME);

    expect(sheet?.getRow(2).getCell(2).value).toBe('Positive');
    expect(sheet?.getRow(2).getCell(3).value).toBe('Keynote');
  });

  it('says what the model input sheet is', async () => {
    const workbook = await readBack(await buildResultsWorkbook({ results, fields, surveyFilename: 'symposium.xlsx' }));
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(inputSheet?.getCell('A1').note).toContain('one column per survey question');
  });

  it('says why a legacy run is not split into columns', async () => {
    const workbook = await readBack(await buildResultsWorkbook({
      results: legacyResults,
      fields,
      surveyFilename: 'symposium.xlsx',
    }));
    const inputSheet = workbook.getWorksheet(MODEL_INPUT_SHEET_NAME);

    expect(inputSheet?.getCell('A1').note).toContain('kept apart');
  });

  // A run whose rows all failed still opens, with both sheets present and empty.
  it('writes both sheets when there are no results', async () => {
    const workbook = await readBack(await buildResultsWorkbook({ results: [], fields, surveyFilename: 's.xlsx' }));

    expect(workbook.getWorksheet(RESULTS_SHEET_NAME)?.rowCount).toBe(1);
    expect(workbook.getWorksheet(MODEL_INPUT_SHEET_NAME)?.rowCount).toBe(1);
  });

  it('produces a spreadsheet blob', async () => {
    const blob = await buildResultsWorkbook({ results, fields, surveyFilename: 'symposium.xlsx' });

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
