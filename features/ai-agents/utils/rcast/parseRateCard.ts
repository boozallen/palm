/**
 * Utility: Parse Rate Card
 *
 * Parses uploaded rate card files (Excel .xlsx or CSV) and extracts labor
 * category data. Handles various column naming conventions and formats
 * including currency symbols and comma-separated numbers.
 *
 * Used by: features/ai-agents/dal/rcast/createRateCard.ts
 */

import ExcelJS from 'exceljs';

export type RateCardRow = {
  laborCategory: string;
  experienceLevel: string;
  rate: number | null;
};

/**
 * Parse rate card file (Excel or CSV) and extract labor category data
 */
export async function parseRateCard(
  buffer: Buffer,
  fileName: string
): Promise<RateCardRow[]> {
  const extension = fileName.toLowerCase().split('.').pop();

  if (extension === 'csv') {
    return parseRateCardCsv(buffer);
  }

  return parseRateCardExcel(buffer);
}

/**
 * Parse rate card CSV file and extract labor category data
 */
export async function parseRateCardCsv(buffer: Buffer): Promise<RateCardRow[]> {
  const content = buffer.toString('utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error('No data found in CSV file');
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());

  const laborCategoryCol = headers.findIndex((h) => h.includes('labor category'));
  const experienceLevelCol = headers.findIndex((h) => h.includes('experience level'));
  const rateCol = headers.findIndex((h) => h === 'rate');

  if (laborCategoryCol === -1 || experienceLevelCol === -1) {
    throw new Error(
      'Could not find required columns in CSV file. Expected columns: "LABOR CATEGORY", "EXPERIENCE LEVEL"'
    );
  }

  const rows: RateCardRow[] = [];

  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);

    const laborCategory = (values[laborCategoryCol] || '').trim();
    const experienceLevel = (values[experienceLevelCol] || '').trim();
    const rate = rateCol !== -1 ? parseFloatValue(values[rateCol]) : null;

    if (!laborCategory || !experienceLevel) {
      continue;
    }

    rows.push({
      laborCategory,
      experienceLevel,
      rate,
    });
  }

  if (rows.length === 0) {
    throw new Error('No valid data rows found in CSV file');
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Parse rate card Excel file and extract labor category data
 */
export async function parseRateCardExcel(
  buffer: Buffer
): Promise<RateCardRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  const rows: RateCardRow[] = [];
  let headerRowIndex = -1;
  let laborCategoryCol = -1;
  let experienceLevelCol = -1;
  let rateCol = -1;

  // Find header row and column indices
  worksheet.eachRow((row, rowIndex) => {
    if (headerRowIndex !== -1) {
      return; // Already found header
    }

    row.eachCell((cell, colNumber) => {
      const value = getCellValue(cell).toLowerCase().trim();

      if (value.includes('labor category')) {
        laborCategoryCol = colNumber;
      } else if (value.includes('experience level')) {
        experienceLevelCol = colNumber;
      } else if (value === 'rate') {
        rateCol = colNumber;
      }
    });

    if (laborCategoryCol !== -1 && experienceLevelCol !== -1) {
      headerRowIndex = rowIndex;
    }
  });

  if (headerRowIndex === -1) {
    throw new Error(
      'Could not find required columns in Excel file. Expected columns: "LABOR CATEGORY", "EXPERIENCE LEVEL"'
    );
  }

  // Parse data rows
  worksheet.eachRow((row, rowIndex) => {
    // Skip header row and everything before it
    if (rowIndex <= headerRowIndex) {
      return;
    }

    const laborCategory = getCellValue(row.getCell(laborCategoryCol)).trim();
    const experienceLevel = getCellValue(row.getCell(experienceLevelCol)).trim();
    const rate = rateCol !== -1 ? parseFloatValue(row.getCell(rateCol).value) : null;

    if (!laborCategory || !experienceLevel) {
      return;
    }

    rows.push({
      laborCategory,
      experienceLevel,
      rate,
    });
  });

  if (rows.length === 0) {
    throw new Error('No valid data rows found in Excel file');
  }

  return rows;
}

/**
 * Get cell value as string
 */
function getCellValue(cell: any): string {
  if (!cell) {
    return '';
  }
  const value = cell.value;
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'object' && 'text' in value) {
    return value.text;
  }
  return String(value);
}

/**
 * Parse numeric value from cell
 */
function parseFloatValue(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // If it's already a number, return it
  if (typeof value === 'number') {
    return value;
  }

  // If it's a string, clean and parse it
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,$]/g, '').trim();
    const parsed = Number.parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}
