import * as ExcelJS from 'exceljs';

import parseSurveySpreadsheet from '@/features/ai-agents/utils/pulse/worker/parseSurveySpreadsheet';
import loadWorkbook from '@/features/ai-agents/utils/pulse/loadWorkbook';
import type { PulseInputMapping } from '@/features/ai-agents/types/pulse/surveyAnalysis';

jest.mock('@/features/ai-agents/utils/pulse/loadWorkbook');

const mockLoadWorkbook = loadWorkbook as jest.Mock;

const mapping: PulseInputMapping = {
  sheetName: 'Feedback',
  headerRow: 1,
  inputColumns: ['B'],
};

function buildWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Feedback');
  sheet.addRow(['Id', 'What did you like?']);
  sheet.addRow(['1', 'The mentoring']);
  sheet.addRow(['2', null]);
  sheet.addRow(['3', 'The keynote']);
  return workbook;
}

describe('parseSurveySpreadsheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns every respondent row with every survey column', async () => {
    const workbook = buildWorkbook();
    mockLoadWorkbook.mockResolvedValue(workbook);

    const parsed = await parseSurveySpreadsheet(Buffer.from('xlsx'), mapping);

    expect(parsed.workbook).toBe(workbook);
    expect(parsed.rows.map((row) => row.rowNumber)).toEqual([2, 3, 4]);
    expect(parsed.surveyColumns.map((column) => column.letter)).toEqual(['A', 'B']);
    expect(parsed.surveyColumns[0].values).toEqual(['1', '2', '3']);
  });

  it('rejects a file that is not a readable workbook', async () => {
    mockLoadWorkbook.mockRejectedValue(new Error('zip end of central directory not found'));

    await expect(parseSurveySpreadsheet(Buffer.from('nope'), mapping)).rejects.toThrow();
  });
});
