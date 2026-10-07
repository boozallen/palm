import * as ExcelJS from 'exceljs';

import parsePromptMatrix, {
  MATRIX_FALLBACK_VALUE,
  MATRIX_MAX_FIELDS,
  MATRIX_SHEET_NAME,
} from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import {
  fallbackIsAllowedValueError,
  formatPulseError,
  matrixMissingHeaderError,
  matrixNoUsableRowsError,
  matrixTooManyColumnsError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import {
  PulseFieldType,
  type PulseSurveyHeader,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

const HEADERS = ['Column name', 'Source columns', 'Prompt', 'Allowed values'];
const SURVEY_HEADERS: PulseSurveyHeader[] = [
  { letter: 'A', header: 'ID' },
  { letter: 'B', header: 'Region' },
  { letter: 'C', header: 'Revenue' },
  { letter: 'D', header: 'How did we do?' },
];

type SheetSpec = { name?: string; rows: Array<Array<string | null>> };

async function buildFile(sheets: SheetSpec[]): Promise<File> {
  const workbook = new ExcelJS.Workbook();

  sheets.forEach((spec, index) => {
    const sheet = workbook.addWorksheet(spec.name ?? `Sheet${index + 1}`);
    spec.rows.forEach((row) => sheet.addRow(row));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { arrayBuffer: async () => buffer } as unknown as File;
}

async function parseRows(rows: Array<Array<string | null>>, surveyHeaders = SURVEY_HEADERS) {
  const file = await buildFile([{ name: MATRIX_SHEET_NAME, rows: [HEADERS, ...rows] }]);
  return parsePromptMatrix(file, surveyHeaders);
}

describe('parsePromptMatrix', () => {
  it('turns one row into one output column', async () => {
    const result = await parseRows([['Sentiment', 'B', 'Choose how they feel.', 'Positive, Negative']]);

    expect(result.fileError).toBeNull();
    expect(result.rowErrors).toEqual([]);
    expect(result.fields).toEqual([{
      fieldName: 'Sentiment',
      prompt: 'Choose how they feel.',
      fieldType: PulseFieldType.CATEGORY,
      allowedValues: ['Positive', 'Negative'],
      defaultValue: MATRIX_FALLBACK_VALUE,
      inputColumnRefs: ['B'],
      sortOrder: 0,
    }]);
  });

  it('reads several source columns from one cell', async () => {
    const result = await parseRows([['Gap', 'b, d', 'Judge the gap across both answers.', 'Low, High']]);

    expect(result.fields[0].inputColumnRefs).toEqual(['B', 'D']);
  });

  it('reads source columns named by their survey header', async () => {
    const result = await parseRows([['Gap', 'region, How did we do?', 'Judge the gap.', 'Low, High']]);

    expect(result.rowErrors).toEqual([]);
    expect(result.fields[0].inputColumnRefs).toEqual(['B', 'D']);
  });

  it('reads space-separated source letters', async () => {
    const result = await parseRows([['Gap', 'A B C', 'Judge the gap.', 'Low, High']]);

    expect(result.fields[0].inputColumnRefs).toEqual(['A', 'B', 'C']);
  });

  it('treats a blank source cell as reading the whole response', async () => {
    const result = await parseRows([['Summary', null, 'Summarize the response.', null]]);

    expect(result.fields[0].inputColumnRefs).toEqual([]);
  });

  it('numbers sortOrder by row position', async () => {
    const result = await parseRows([
      ['First', 'B', 'Prompt one.', 'Yes, No'],
      ['Second', 'B', 'Prompt two.', 'Yes, No'],
    ]);

    expect(result.fields.map((field) => field.sortOrder)).toEqual([0, 1]);
  });

  describe('field type derivation', () => {
    it('is free text when no allowed values are given', async () => {
      const result = await parseRows([['Concern', 'B', 'Summarize their concern.', null]]);

      expect(result.fields[0].fieldType).toBe(PulseFieldType.FREE_TEXT);
      expect(result.fields[0].allowedValues).toEqual([]);
    });

    it('is a scale when every allowed value is numeric', async () => {
      const result = await parseRows([['Readiness', 'B', 'Rate their readiness.', '1, 2, 3, 4, 5']]);

      expect(result.fields[0].fieldType).toBe(PulseFieldType.SCALE);
    });

    it('is a scale for negative and decimal values', async () => {
      const result = await parseRows([['Shift', 'B', 'Rate the shift.', '-1, -0.5, 0, 0.5, 1']]);

      expect(result.fields[0].fieldType).toBe(PulseFieldType.SCALE);
    });

    it('is a scale when values have explicit plus signs', async () => {
      const result = await parseRows([['Direction', 'B', 'Rate the direction.', '-1, 0, +1']]);

      expect(result.fields[0].fieldType).toBe(PulseFieldType.SCALE);
    });

    it('is a category when any allowed value is not numeric', async () => {
      const result = await parseRows([['Readiness', 'B', 'Rate their readiness.', '1, 2, Not applicable']]);

      expect(result.fields[0].fieldType).toBe(PulseFieldType.CATEGORY);
    });
  });

  describe('allowed value delimiters', () => {
    it('splits on commas', async () => {
      const result = await parseRows([['Sentiment', 'B', 'Choose one.', 'Positive, Neutral, Negative']]);

      expect(result.fields[0].allowedValues).toEqual(['Positive', 'Neutral', 'Negative']);
    });

    it('splits on pipes so a value can contain a comma', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', 'Training, equipment | Staffing']]);

      expect(result.fields[0].allowedValues).toEqual(['Training, equipment', 'Staffing']);
    });

    it('splits on newlines in preference to anything else', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', 'Training, equipment\nStaffing | pay']]);

      expect(result.fields[0].allowedValues).toEqual(['Training, equipment', 'Staffing | pay']);
    });

    it('drops blanks and case-insensitive duplicates, keeping the first spelling', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', 'Training, , training, Staffing']]);

      expect(result.fields[0].allowedValues).toEqual(['Training', 'Staffing']);
    });

    it('unwraps values pasted with curly quotes around them', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', '“Training”, “Staffing”']]);

      expect(result.fields[0].allowedValues).toEqual(['Training', 'Staffing']);
    });

    it('unwraps values pasted with straight quotes around them', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', '"Training", \'Staffing\'']]);

      expect(result.fields[0].allowedValues).toEqual(['Training', 'Staffing']);
    });

    it('keeps an apostrophe inside a value', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', 'Don\'t know, Leader\'s call']]);

      expect(result.fields[0].allowedValues).toEqual(['Don\'t know', 'Leader\'s call']);
    });

    it('keeps a quote that does not wrap the whole value', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', '“Training | Staffing']]);

      expect(result.fields[0].allowedValues).toEqual(['“Training', 'Staffing']);
    });
  });

  describe('worksheet and header location', () => {
    it('prefers the sheet named Prompt Matrix over the first sheet', async () => {
      const file = await buildFile([
        { name: 'Notes', rows: [HEADERS, ['Wrong', 'B', 'From the notes sheet.', 'Yes, No']] },
        { name: 'Prompt Matrix', rows: [HEADERS, ['Right', 'B', 'From the matrix sheet.', 'Yes, No']] },
      ]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields.map((field) => field.fieldName)).toEqual(['Right']);
    });

    it('matches the sheet name ignoring case and spacing', async () => {
      const file = await buildFile([
        { name: 'Notes', rows: [['just notes']] },
        { name: 'promptmatrix', rows: [HEADERS, ['Right', 'B', 'From the matrix sheet.', 'Yes, No']] },
      ]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields.map((field) => field.fieldName)).toEqual(['Right']);
    });

    it('falls back to the first sheet when none is named Prompt Matrix', async () => {
      const file = await buildFile([
        { name: 'Sheet1', rows: [HEADERS, ['Sentiment', 'B', 'Choose one.', 'Yes, No']] },
      ]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields).toHaveLength(1);
    });

    it('finds a header row below a title row and a blank row', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [
          ['Symposium prompt matrix'],
          [null],
          HEADERS,
          ['Sentiment', 'B', 'Choose one.', 'Yes, No'],
        ],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields).toHaveLength(1);
      expect(result.fileError).toBeNull();
    });

    it('prefers a four-column header over a data row that matches two header synonyms', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [
          ['name', 'A', 'prompt', 'Yes'],
          HEADERS,
          ['Sentiment', 'B', 'Choose one.', 'Positive, Negative'],
        ],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields[0].fieldName).toBe('Sentiment');
      expect(result.fields[0].prompt).toBe('Choose one.');
      expect(result.fields[0].inputColumnRefs).toEqual(['B']);
    });

    it('accepts header synonyms', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [
          ['New column', 'Input columns', 'Instructions', 'Options'],
          ['Sentiment', 'B', 'Choose one.', 'Yes, No'],
        ],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields).toHaveLength(1);
    });

    it('accepts a header that surrounds a synonym with other words', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [
          ['New Column Name', 'Source Column Letter(s)', 'Prompt'],
          ['Presenter', 'C', 'Extract their first and last name.'],
        ],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fileError).toBeNull();
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0].fieldName).toBe('Presenter');
      expect(result.fields[0].inputColumnRefs).toEqual(['C']);
    });

    it('reads a header naming two columns as the longer of the two', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [
          ['Output column', 'Source column name', 'Prompt'],
          ['Presenter', 'B', 'Extract their name.'],
        ],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields[0].fieldName).toBe('Presenter');
      expect(result.fields[0].inputColumnRefs).toEqual(['B']);
    });

    it('ignores columns it does not recognize', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [
          ['Owner', 'Column name', 'Source columns', 'Prompt', 'Allowed values', 'Notes'],
          ['Josh', 'Sentiment', 'B', 'Choose one.', 'Yes, No', 'draft'],
        ],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields[0].fieldName).toBe('Sentiment');
    });

    it('works without an allowed values column at all', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [
          ['Column name', 'Source columns', 'Prompt'],
          ['Concern', 'B', 'Summarize their concern.'],
        ],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields[0].fieldType).toBe(PulseFieldType.FREE_TEXT);
    });

    it('skips a blank row between two real ones', async () => {
      const result = await parseRows([
        ['First', 'B', 'Prompt one.', 'Yes, No'],
        [null, null, null, null],
        ['Second', 'B', 'Prompt two.', 'Yes, No'],
      ]);

      expect(result.fields.map((field) => field.fieldName)).toEqual(['First', 'Second']);
      expect(result.rowErrors).toEqual([]);
    });
  });

  describe('row errors', () => {
    it('reports a row with no column name against its worksheet row number', async () => {
      const result = await parseRows([[null, 'B', 'Choose one.', 'Yes, No']]);

      expect(result.fields).toEqual([]);
      expect(result.rowErrors).toEqual([{ row: 2, message: 'This row has no column name.' }]);
    });

    it('reports a duplicate column name', async () => {
      const result = await parseRows([
        ['Sentiment', 'B', 'Choose one.', 'Yes, No'],
        ['sentiment', 'B', 'Choose one again.', 'Yes, No'],
      ]);

      expect(result.fields).toHaveLength(1);
      expect(result.rowErrors).toHaveLength(1);
      expect(result.rowErrors[0].row).toBe(3);
      expect(result.rowErrors[0].message).toContain('already used');
    });

    it('reports a column name over 100 characters', async () => {
      const result = await parseRows([['N'.repeat(101), 'B', 'Choose one.', 'Yes, No']]);

      expect(result.rowErrors[0].message).toContain('under 100 characters');
    });

    it('reports a row with no prompt', async () => {
      const result = await parseRows([['Sentiment', 'B', null, 'Yes, No']]);

      expect(result.rowErrors).toEqual([
        { row: 2, message: '"Sentiment" has no prompt. Describe what this column should contain.' },
      ]);
    });

    it('reports a prompt over 4000 characters', async () => {
      const result = await parseRows([['Sentiment', 'B', 'p'.repeat(4001), 'Yes, No']]);

      expect(result.rowErrors[0].message).toContain('under 4000 characters');
    });

    it('reports more than 50 allowed values', async () => {
      const values = Array.from({ length: 51 }, (_, index) => `Value ${index}`).join('|');
      const result = await parseRows([['Theme', 'B', 'Choose one.', values]]);

      expect(result.rowErrors[0].message).toContain('more than 50 allowed values');
    });

    it('reports an allowed value that repeats the fallback a failed cell already gets', async () => {
      const result = await parseRows([['Theme', 'B', 'Choose one.', `Training, ${MATRIX_FALLBACK_VALUE.toLowerCase()}`]]);

      expect(result.fields).toEqual([]);
      expect(result.rowErrors).toEqual([{
        row: 2,
        message: formatPulseError(fallbackIsAllowedValueError('Theme', MATRIX_FALLBACK_VALUE)),
      }]);
    });

    it('reports a source column the survey does not have, listing the ones it does', async () => {
      const result = await parseRows([['Sentiment', 'Q', 'Choose one.', 'Yes, No']]);

      expect(result.rowErrors).toEqual([{
        row: 2,
        message: '\'Q\' doesn\'t match any survey column.\n\nFix: Use a column letter or one of: A – ID, B – Region, C – Revenue, D – How did we do?',
      }]);
    });

    it('reports a source name that matches no survey header', async () => {
      const result = await parseRows([['Sentiment', 'Regoin', 'Choose one.', 'Yes, No']]);

      expect(result.fields).toEqual([]);
      expect(result.rowErrors[0].message).toContain('\'Regoin\' doesn\'t match any survey column.');
    });

    // Before a survey is chosen there is nothing to check source columns against.
    it('accepts source letters and holds source names when the survey is not loaded yet', async () => {
      const result = await parseRows([
        ['Sentiment', 'Q', 'Choose one.', 'Yes, No'],
        ['Region trend', 'Region', 'Describe the region.', null],
      ], []);

      expect(result.rowErrors).toEqual([]);
      expect(result.fields.map((field) => field.inputColumnRefs)).toEqual([['Q'], []]);
    });

    it('keeps the good rows when one row is bad', async () => {
      const result = await parseRows([
        ['First', 'B', 'Prompt one.', 'Yes, No'],
        [null, 'B', 'Prompt two.', 'Yes, No'],
        ['Third', 'B', 'Prompt three.', 'Yes, No'],
      ]);

      expect(result.fields.map((field) => field.fieldName)).toEqual(['First', 'Third']);
      expect(result.fields.map((field) => field.sortOrder)).toEqual([0, 1]);
      expect(result.rowErrors).toHaveLength(1);
    });
  });

  describe('file errors', () => {
    it('names the missing column name header and the headers it found', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [['Thing', 'Source columns', 'Prompt'], ['Sentiment', 'B', 'Choose one.']],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fields).toEqual([]);
      expect(result.fileError).toBe(formatPulseError(
        matrixMissingHeaderError('Column name', ['Thing', 'Source columns', 'Prompt']),
      ));
    });

    it('names the missing prompt header', async () => {
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [['Column name', 'Source columns'], ['Sentiment', 'B']],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fileError).toBe(formatPulseError(
        matrixMissingHeaderError('Prompt', ['Column name', 'Source columns']),
      ));
    });

    it('rejects a header row below the tenth row', async () => {
      const filler = Array.from({ length: 10 }, () => [null]);
      const file = await buildFile([{
        name: MATRIX_SHEET_NAME,
        rows: [...filler, HEADERS, ['Sentiment', 'B', 'Choose one.', 'Yes, No']],
      }]);

      const result = await parsePromptMatrix(file, SURVEY_HEADERS);

      expect(result.fileError).toBe(formatPulseError(matrixMissingHeaderError('Column name', [])));
    });

    it('reports a matrix with a header and nothing under it', async () => {
      const result = await parseRows([]);

      expect(result.fields).toEqual([]);
      expect(result.fileError).toBe(formatPulseError(matrixNoUsableRowsError()));
    });

    // Silently keeping 25 of 30 would run an analysis missing columns the user asked for.
    it('reports an over-cap matrix as a file error rather than truncating it', async () => {
      const rows = Array.from({ length: 26 }, (_, index) => (
        [`Column ${index}`, 'B', `Prompt ${index}.`, 'Yes, No']
      ));

      const result = await parseRows(rows);

      expect(result.fields).toHaveLength(25);
      expect(result.fileError).toBe(formatPulseError(matrixTooManyColumnsError(26, MATRIX_MAX_FIELDS)));
    });

    it('throws a readable message when the file is not a workbook', async () => {
      const file = { arrayBuffer: async () => new ArrayBuffer(4) } as unknown as File;

      await expect(parsePromptMatrix(file, SURVEY_HEADERS)).rejects.toThrow(
        'Failed to read the prompt matrix workbook. Please ensure it is a valid .xlsx file.',
      );
    });
  });
});
