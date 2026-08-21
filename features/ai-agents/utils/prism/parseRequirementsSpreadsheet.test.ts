import ExcelJS from 'exceljs';
import logger from '@/server/logger';
import { parseRequirementsSpreadsheet } from './parseRequirementsSpreadsheet';

jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

async function createWorkbook(
  sheets: Array<{ name: string; rows: string[] }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      worksheet.addRow([row]);
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createMultiColumnWorkbook(
  sheets: Array<{ name: string; rows: Array<string[]> }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      worksheet.addRow(row);
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('parseRequirementsSpreadsheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse requirements that follow a header row', async () => {
    const buffer = await createWorkbook([
      {
        name: 'Sheet1',
        rows: [
          'Requirement',
          'The system shall support 1,000 concurrent users.',
          'All data shall be encrypted using TLS 1.2 or higher.',
        ],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    expect(result).toHaveLength(2);
    expect(result[0].requirement).toBe('The system shall support 1,000 concurrent users.');
    expect(result[1].requirement).toBe('All data shall be encrypted using TLS 1.2 or higher.');
  });

  it('should set category to null for a single sheet', async () => {
    const buffer = await createWorkbook([
      {
        name: 'Requirements',
        rows: ['Requirement', 'The system shall support 1,000 concurrent users.'],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    expect(result[0].category).toBeNull();
  });

  it('should use sheet name as category when multiple sheets exist', async () => {
    const buffer = await createWorkbook([
      {
        name: 'Technical',
        rows: ['Requirement', 'The system shall support 1,000 concurrent users.'],
      },
      {
        name: 'Security',
        rows: ['Requirement', 'All data shall be encrypted using TLS 1.2 or higher.'],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    expect(result[0].category).toBe('Technical');
    expect(result[1].category).toBe('Security');
  });

  it('should skip sheets where the Requirement header is not in the first row', async () => {
    const buffer = await createWorkbook([
      {
        name: 'NoHeader',
        rows: [
          'This is not a header',
          'Requirement', // buried in row 2 — should be ignored
          'This is not a requirement',
        ],
      },
      {
        name: 'Valid',
        rows: ['Requirement', 'This is a real requirement'],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    // Only the Valid sheet qualifies — single valid sheet → category is null
    expect(result).toHaveLength(1);
    expect(result[0].requirement).toBe('This is a real requirement');
  });

  it('should skip empty rows', async () => {
    const buffer = await createWorkbook([
      {
        name: 'Sheet1',
        rows: [
          'Requirement',
          'The system shall support 1,000 concurrent users.',
          '',
          'All data shall be encrypted using TLS 1.2 or higher.',
        ],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    expect(result).toHaveLength(2);
  });

  it('should include duplicate requirements across sheets', async () => {
    const duplicate = 'The system shall support 1,000 concurrent users.';
    const buffer = await createWorkbook([
      {
        name: 'Technical',
        rows: ['Requirement', duplicate],
      },
      {
        name: 'Security',
        rows: ['Requirement', duplicate, 'All data shall be encrypted using TLS 1.2 or higher.'],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    const matching = result.filter((r) => r.requirement === duplicate);
    expect(matching).toHaveLength(2);
  });

  it('should preserve each sheet category for requirements that appear on multiple sheets', async () => {
    const duplicate = 'Shared requirement';
    const buffer = await createWorkbook([
      { name: 'Tab1', rows: ['Requirement', duplicate] },
      { name: 'Tab2', rows: ['Requirement', duplicate] },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    const matching = result.filter((r) => r.requirement === duplicate);
    expect(matching).toHaveLength(2);
    expect(matching[0].category).toBe('Tab1');
    expect(matching[1].category).toBe('Tab2');
  });

  it('should skip sheets with no header row', async () => {
    const buffer = await createWorkbook([
      { name: 'NoHeader', rows: ['Just some text', 'More text'] },
      { name: 'Technical', rows: ['Requirement', 'A valid requirement'] },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    // Only Technical qualifies — single valid sheet → category is null
    expect(result).toHaveLength(1);
    expect(result[0].category).toBeNull();
  });

  it('should throw when no sheet has a valid header', async () => {
    const buffer = await createWorkbook([
      { name: 'Sheet1', rows: ['Column A', 'Some value', 'Another value'] },
    ]);

    await expect(parseRequirementsSpreadsheet(buffer)).rejects.toThrow(
      'No requirements found. Each sheet must have a column named "Requirement"',
    );
  });

  it('should throw when spreadsheet has no header and no requirements', async () => {
    const buffer = await createWorkbook([
      { name: 'Sheet1', rows: ['C.1', 'C.2', 'C.3'] },
    ]);

    await expect(parseRequirementsSpreadsheet(buffer)).rejects.toThrow(
      'No requirements found. Each sheet must have a column named "Requirement"',
    );
  });

  it('should throw when header row exists but has no requirements after it', async () => {
    const buffer = await createWorkbook([
      { name: 'Sheet1', rows: ['Requirement'] },
    ]);

    await expect(parseRequirementsSpreadsheet(buffer)).rejects.toThrow(
      'No requirements found. Each sheet must have a column named "Requirement"',
    );
  });

  it('should log info after successful parse', async () => {
    const buffer = await createWorkbook([
      { name: 'Sheet1', rows: ['Requirement', 'A requirement'] },
    ]);

    await parseRequirementsSpreadsheet(buffer);

    expect(logger.info).toHaveBeenCalledWith(
      'Parsed requirements spreadsheet',
      expect.objectContaining({
        totalRequirements: 1,
      }),
    );
  });

  it('should throw a descriptive error for invalid buffer', async () => {
    const invalidBuffer = Buffer.from('not a valid xlsx file');

    await expect(parseRequirementsSpreadsheet(invalidBuffer)).rejects.toThrow(
      'Failed to parse requirements spreadsheet. Please ensure it is a valid .xlsx file.',
    );
  });

  it('should log error when parsing fails', async () => {
    const invalidBuffer = Buffer.from('not a valid xlsx file');

    await expect(parseRequirementsSpreadsheet(invalidBuffer)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      'Error parsing requirements spreadsheet: ',
      expect.any(Error),
    );
  });

  it('should trim whitespace from requirement text', async () => {
    const buffer = await createWorkbook([
      { name: 'Sheet1', rows: ['Requirement', '  A requirement with whitespace  '] },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    expect(result[0].requirement).toBe('A requirement with whitespace');
  });

  it('should find the Requirement header in a non-first column', async () => {
    const buffer = await createMultiColumnWorkbook([
      {
        name: 'Sheet1',
        rows: [
          ['ID', 'Requirement', 'Priority'],
          ['C.1', 'The system shall support 1,000 concurrent users.', 'High'],
          ['C.2', 'All data shall be encrypted using TLS 1.2 or higher.', 'High'],
        ],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    expect(result).toHaveLength(2);
    expect(result[0].requirement).toBe('The system shall support 1,000 concurrent users.');
    expect(result[1].requirement).toBe('All data shall be encrypted using TLS 1.2 or higher.');
  });

  it('should ignore columns other than the Requirement column', async () => {
    const buffer = await createMultiColumnWorkbook([
      {
        name: 'Sheet1',
        rows: [
          ['ID', 'Requirement', 'Notes'],
          ['C.1', 'Only this text should be collected', 'This should be ignored'],
        ],
      },
    ]);

    const result = await parseRequirementsSpreadsheet(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].requirement).toBe('Only this text should be collected');
  });
});
