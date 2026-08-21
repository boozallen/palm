import ExcelJS from 'exceljs';
import { parseRateCard, parseRateCardExcel, parseRateCardCsv } from './parseRateCard';

describe('parseRateCardExcel', () => {
  async function createTestWorkbook(
    headers: string[],
    dataRows: (string | number | null)[][]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.addRow(headers);
    dataRows.forEach((row) => { worksheet.addRow(row); });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  it('should parse valid rate card Excel file', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      [
        ['Software Engineer', 'Senior', 150.0],
        ['Data Scientist', 'Mid-Level', 125.0],
      ]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toEqual([
      { laborCategory: 'Software Engineer', experienceLevel: 'Senior', rate: 150.0 },
      { laborCategory: 'Data Scientist', experienceLevel: 'Mid-Level', rate: 125.0 },
    ]);
  });

  it('should parse file with case-insensitive headers', async () => {
    const buffer = await createTestWorkbook(
      ['LABOR CATEGORY', 'EXPERIENCE LEVEL', 'RATE'],
      [['Software Engineer', 'Senior', 150.0]]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].laborCategory).toBe('Software Engineer');
  });

  it('should parse rates with currency symbols', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      [['Software Engineer', 'Senior', '$150.00']]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result[0].rate).toBe(150.0);
  });

  it('should parse rates with commas', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      [['Software Engineer', 'Senior', '1,150.00']]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result[0].rate).toBe(1150.0);
  });

  it('should skip rows with missing labor category', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      [
        ['Software Engineer', 'Senior', 150.0],
        ['', 'Mid-Level', 125.0],
        ['Data Scientist', 'Junior', 100.0],
      ]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toHaveLength(2);
    expect(result[0].laborCategory).toBe('Software Engineer');
    expect(result[1].laborCategory).toBe('Data Scientist');
  });

  it('should skip rows with missing experience level', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      [
        ['Software Engineer', 'Senior', 150.0],
        ['Data Scientist', '', 125.0],
        ['DevOps Engineer', 'Mid-Level', 135.0],
      ]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toHaveLength(2);
    expect(result[0].laborCategory).toBe('Software Engineer');
    expect(result[1].laborCategory).toBe('DevOps Engineer');
  });

  it('should allow rows with missing rate column — rate is null', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level'],
      [
        ['Software Engineer', 'Senior'],
        ['Data Scientist', 'Mid-Level'],
      ]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toHaveLength(2);
    expect(result[0].rate).toBeNull();
    expect(result[1].rate).toBeNull();
  });

  it('should allow rows where rate cell is null — rate is null', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      [
        ['Software Engineer', 'Senior', null],
        ['DevOps Engineer', 'Senior', 140.0],
      ]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toHaveLength(2);
    expect(result[0].rate).toBeNull();
    expect(result[1].rate).toBe(140.0);
  });

  it('should throw if no worksheet found', async () => {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseRateCardExcel(buffer)).rejects.toThrow(
      'No worksheet found in Excel file'
    );
  });

  it('should throw if required columns (labor category + experience level) not found', async () => {
    const buffer = await createTestWorkbook(
      ['Column A', 'Column B', 'Column C'],
      [['value1', 'value2', 'value3']]
    );

    await expect(parseRateCardExcel(buffer)).rejects.toThrow(
      'Could not find required columns in Excel file'
    );
  });

  it('should throw if missing labor category column', async () => {
    const buffer = await createTestWorkbook(
      ['Experience Level', 'Rate'],
      [['Senior', 150.0]]
    );

    await expect(parseRateCardExcel(buffer)).rejects.toThrow(
      'Could not find required columns in Excel file'
    );
  });

  it('should throw if missing experience level column', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Rate'],
      [['Software Engineer', 150.0]]
    );

    await expect(parseRateCardExcel(buffer)).rejects.toThrow(
      'Could not find required columns in Excel file'
    );
  });

  it('should NOT throw if only rate column is missing — rate defaults to null', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level'],
      [['Software Engineer', 'Senior']]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].rate).toBeNull();
  });

  it('should throw if no valid data rows found', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      []
    );

    await expect(parseRateCardExcel(buffer)).rejects.toThrow(
      'No valid data rows found in Excel file'
    );
  });

  it('should handle headers with extra whitespace', async () => {
    const buffer = await createTestWorkbook(
      ['  Labor Category  ', ' Experience Level ', '  Rate  '],
      [['Software Engineer', 'Senior', 150.0]]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].laborCategory).toBe('Software Engineer');
  });

  it('should trim whitespace from cell values', async () => {
    const buffer = await createTestWorkbook(
      ['Labor Category', 'Experience Level', 'Rate'],
      [['  Software Engineer  ', '  Senior  ', 150.0]]
    );

    const result = await parseRateCardExcel(buffer);

    expect(result[0].laborCategory).toBe('Software Engineer');
    expect(result[0].experienceLevel).toBe('Senior');
  });
});

describe('parseRateCardCsv', () => {
  function createCsvBuffer(content: string): Buffer {
    return Buffer.from(content, 'utf-8');
  }

  it('should parse valid CSV file', async () => {
    const csv = `Labor Category,Experience Level,Rate
Software Engineer,Senior,150.00
Data Scientist,Mid-Level,125.00`;

    const result = await parseRateCardCsv(createCsvBuffer(csv));

    expect(result).toEqual([
      { laborCategory: 'Software Engineer', experienceLevel: 'Senior', rate: 150.0 },
      { laborCategory: 'Data Scientist', experienceLevel: 'Mid-Level', rate: 125.0 },
    ]);
  });

  it('should parse CSV with case-insensitive headers', async () => {
    const csv = `LABOR CATEGORY,EXPERIENCE LEVEL,RATE
Software Engineer,Senior,150.00`;

    const result = await parseRateCardCsv(createCsvBuffer(csv));

    expect(result).toHaveLength(1);
    expect(result[0].laborCategory).toBe('Software Engineer');
  });

  it('should parse rates with currency symbols', async () => {
    const csv = `Labor Category,Experience Level,Rate
Software Engineer,Senior,$150.00`;

    const result = await parseRateCardCsv(createCsvBuffer(csv));

    expect(result[0].rate).toBe(150.0);
  });

  it('should parse rates with commas in quoted values', async () => {
    const csv = `Labor Category,Experience Level,Rate
"Software Engineer, Lead",Senior,"1,150.00"`;

    const result = await parseRateCardCsv(createCsvBuffer(csv));

    expect(result[0].laborCategory).toBe('Software Engineer, Lead');
    expect(result[0].rate).toBe(1150.0);
  });

  it('should skip rows with missing required data', async () => {
    const csv = `Labor Category,Experience Level,Rate
Software Engineer,Senior,150.00
,Mid-Level,125.00
Data Scientist,Junior,100.00`;

    const result = await parseRateCardCsv(createCsvBuffer(csv));

    expect(result).toHaveLength(2);
    expect(result[0].laborCategory).toBe('Software Engineer');
    expect(result[1].laborCategory).toBe('Data Scientist');
  });

  it('should allow CSV without rate column — rate is null', async () => {
    const csv = `Labor Category,Experience Level
Software Engineer,Senior
Data Scientist,Junior`;

    const result = await parseRateCardCsv(createCsvBuffer(csv));

    expect(result).toHaveLength(2);
    expect(result[0].rate).toBeNull();
    expect(result[1].rate).toBeNull();
  });

  it('should throw if no data in CSV file', async () => {
    await expect(parseRateCardCsv(createCsvBuffer(''))).rejects.toThrow(
      'No data found in CSV file'
    );
  });

  it('should throw if required columns not found', async () => {
    const csv = `Column A,Column B,Column C
value1,value2,value3`;

    await expect(parseRateCardCsv(createCsvBuffer(csv))).rejects.toThrow(
      'Could not find required columns in CSV file'
    );
  });

  it('should throw if no valid data rows found', async () => {
    await expect(
      parseRateCardCsv(createCsvBuffer('Labor Category,Experience Level,Rate'))
    ).rejects.toThrow('No valid data rows found in CSV file');
  });

  it('should handle Windows line endings', async () => {
    const csv =
      'Labor Category,Experience Level,Rate\r\nSoftware Engineer,Senior,150.00\r\nData Scientist,Mid-Level,125.00';

    const result = await parseRateCardCsv(createCsvBuffer(csv));

    expect(result).toHaveLength(2);
  });
});

describe('parseRateCard', () => {
  it('should call parseRateCardCsv for .csv files', async () => {
    const csv = `Labor Category,Experience Level,Rate
Software Engineer,Senior,150.00`;
    const buffer = Buffer.from(csv, 'utf-8');

    const result = await parseRateCard(buffer, 'test.csv');

    expect(result).toHaveLength(1);
    expect(result[0].laborCategory).toBe('Software Engineer');
  });

  it('should call parseRateCardExcel for .xlsx files', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.addRow(['Labor Category', 'Experience Level', 'Rate']);
    worksheet.addRow(['Software Engineer', 'Senior', 150.0]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseRateCard(buffer, 'test.xlsx');

    expect(result).toHaveLength(1);
    expect(result[0].laborCategory).toBe('Software Engineer');
  });

  it('should handle uppercase file extensions', async () => {
    const csv = `Labor Category,Experience Level,Rate
Software Engineer,Senior,150.00`;
    const buffer = Buffer.from(csv, 'utf-8');

    const result = await parseRateCard(buffer, 'TEST.CSV');

    expect(result).toHaveLength(1);
  });

  it('should default to Excel parsing for unknown extensions', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.addRow(['Labor Category', 'Experience Level', 'Rate']);
    worksheet.addRow(['Software Engineer', 'Senior', 150.0]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseRateCard(buffer, 'test.xls');

    expect(result).toHaveLength(1);
  });

  it('should parse Excel files without rate column — rate is null', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.addRow(['Labor Category', 'Experience Level']);
    worksheet.addRow(['Analyst', 'Junior']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseRateCard(buffer, 'test.xlsx');

    expect(result).toHaveLength(1);
    expect(result[0].rate).toBeNull();
  });
});
