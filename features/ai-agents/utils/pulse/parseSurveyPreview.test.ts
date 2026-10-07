import * as ExcelJS from 'exceljs';

import parseSurveyPreview from './parseSurveyPreview';
import {
  formatPulseError,
  surveyUnreadableError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { PulseInputMapping } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const mapping: PulseInputMapping = {
  sheetName: 'Feedback',
  headerRow: 1,
  inputColumns: ['B'],
};

async function buildFile(rows: Array<Array<string | null>>): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Feedback');
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return { arrayBuffer: async () => buffer } as unknown as File;
}

describe('parseSurveyPreview', () => {
  it('returns every mapped row so any response can be tested', async () => {
    const file = await buildFile([
      ['Id', 'What did you like?'],
      ['1', 'Answer 1'],
      ['2', 'Answer 2'],
      ['3', 'Answer 3'],
      ['4', 'Answer 4'],
      ['5', 'Answer 5'],
    ]);

    const preview = await parseSurveyPreview(file, mapping);

    expect(preview.responseCount).toBe(5);
    expect(preview.rows).toHaveLength(5);
    expect(preview.rows.map((row) => row.rowNumber)).toEqual([2, 3, 4, 5, 6]);
  });

  it('reports a friendly message when the workbook cannot be read', async () => {
    const file = { arrayBuffer: async () => new ArrayBuffer(4) } as unknown as File;

    await expect(parseSurveyPreview(file, mapping)).rejects.toThrow(formatPulseError(surveyUnreadableError()));
  });
});
