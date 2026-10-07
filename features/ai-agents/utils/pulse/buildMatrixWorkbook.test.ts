import * as ExcelJS from 'exceljs';

import buildMatrixWorkbook from '@/features/ai-agents/utils/pulse/buildMatrixWorkbook';
import parsePromptMatrix, {
  MATRIX_FALLBACK_VALUE,
  MATRIX_SHEET_NAME,
} from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const FIELDS = [
  {
    fieldName: 'Sentiment',
    prompt: 'Choose how they feel about the session.',
    fieldType: PulseFieldType.CATEGORY,
    allowedValues: ['Positive', 'Neutral', 'Negative'],
    defaultValue: MATRIX_FALLBACK_VALUE,
    inputColumnRefs: ['B'],
    sortOrder: 0,
  },
  {
    fieldName: 'Main concern',
    prompt: 'Summarize their main concern in under 12 words.',
    fieldType: PulseFieldType.FREE_TEXT,
    allowedValues: [],
    defaultValue: MATRIX_FALLBACK_VALUE,
    inputColumnRefs: ['B', 'C'],
    sortOrder: 1,
  },
];

async function loadSheet(blob: Blob): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());

  const sheet = workbook.getWorksheet(MATRIX_SHEET_NAME);

  if (!sheet) {
    throw new Error(`Expected a worksheet named ${MATRIX_SHEET_NAME}`);
  }

  return sheet;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): string[] {
  return [1, 2, 3, 4].map((column) => String(sheet.getRow(rowNumber).getCell(column).value ?? ''));
}

// The parser reads files the browser produced, so it needs Blob.arrayBuffer in jsdom.
beforeAll(() => {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = async function arrayBuffer(): Promise<ArrayBuffer> {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read Blob as ArrayBuffer'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

describe('buildMatrixWorkbook', () => {
  it('writes the sheet the parser looks for', async () => {
    const sheet = await loadSheet(await buildMatrixWorkbook(FIELDS));

    expect(sheet.name).toBe(MATRIX_SHEET_NAME);
  });

  it('writes the four headers in order', async () => {
    const sheet = await loadSheet(await buildMatrixWorkbook(FIELDS));

    expect(rowValues(sheet, 1)).toEqual(['Column name', 'Source columns', 'Prompt', 'Allowed values']);
  });

  it('writes one row per configured column', async () => {
    const sheet = await loadSheet(await buildMatrixWorkbook(FIELDS));

    expect(rowValues(sheet, 2)).toEqual([
      'Sentiment',
      'B',
      'Choose how they feel about the session.',
      'Positive\nNeutral\nNegative',
    ]);
    expect(rowValues(sheet, 3)).toEqual([
      'Main concern',
      'B, C',
      'Summarize their main concern in under 12 words.',
      '',
    ]);
  });

  it('wraps the allowed values cell so multiple values stay readable', async () => {
    const sheet = await loadSheet(await buildMatrixWorkbook(FIELDS));

    expect(sheet.getRow(2).getCell(4).alignment).toEqual({ wrapText: true, vertical: 'top' });
  });

  it('fills the blank template with example rows to copy', async () => {
    const sheet = await loadSheet(await buildMatrixWorkbook([]));

    expect(sheet.rowCount).toBeGreaterThan(1);
    expect(rowValues(sheet, 2)[0].length).toBeGreaterThan(0);
  });

  // Pins the template to the parser: a format change that breaks one breaks this test.
  it('round-trips the template back through the parser', async () => {
    const blob = await buildMatrixWorkbook([]);
    const file = { arrayBuffer: async () => blob.arrayBuffer() } as unknown as File;

    const surveyHeaders = [
      { letter: 'A', header: 'ID' },
      { letter: 'B', header: 'Region' },
      { letter: 'C', header: 'Revenue' },
      { letter: 'D', header: 'Comment' },
    ];
    const result = await parsePromptMatrix(file, surveyHeaders);

    expect(result.fileError).toBeNull();
    expect(result.rowErrors).toEqual([]);
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.fields.map((field) => field.fieldType)).toContain(PulseFieldType.FREE_TEXT);
    expect(result.fields.map((field) => field.fieldType)).toContain(PulseFieldType.CATEGORY);
    expect(result.fields.map((field) => field.fieldType)).toContain(PulseFieldType.SCALE);
  });

  it('round-trips a configured matrix back to the same fields', async () => {
    const blob = await buildMatrixWorkbook(FIELDS);
    const file = { arrayBuffer: async () => blob.arrayBuffer() } as unknown as File;

    const surveyHeaders = [
      { letter: 'A', header: 'ID' },
      { letter: 'B', header: 'Region' },
      { letter: 'C', header: 'Revenue' },
      { letter: 'D', header: 'Comment' },
    ];
    const result = await parsePromptMatrix(file, surveyHeaders);

    expect(result.fields).toEqual(FIELDS);
  });
});
