import pdf from 'pdf-parse'; // .pdf
import mammoth from 'mammoth'; // .doc, .docx
import * as Excel from 'exceljs'; // .xlsx

import logger from '@/server/logger';

/**
 * Sanitizes extracted text to prevent UTF-8 encoding issues in PostgreSQL
 * Removes null bytes and other problematic control characters
 */
function removeProblematicCharacters(text: string): string {
  // Remove null bytes and problematic control characters
  // Keep essential whitespace: tab (\x09), newline (\x0A), carriage return (\x0D)
  const sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Normalize excessive whitespace while preserving structure
  return sanitized.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

export async function parseFile(buffer: Buffer, contentType: string): Promise<string> {
  switch (contentType) {
    case 'text/plain':
    case 'text/markdown':
    case 'text/html':
    case 'text/csv':
      return await parsePlainText(buffer);
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await parseWord(buffer);
    // todo: support application/vnd.ms-excel (.xls)
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return await parseExcelXlsx(buffer);
    case 'application/pdf':
      return await parsePdf(buffer);
    default:
      throw new Error('Unable to parse file. Unsupported content type.');
  }
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return removeProblematicCharacters(data.text);
  } catch (error) {
    logger.error(`PDF parsing error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error('Failed to parse PDF');
  }
}

// Supports: .doc, .docx
export async function parseWord(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: buffer });
    return removeProblematicCharacters(result.value);
  } catch (error) {
    logger.error(`Word document parsing error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error('Failed to parse Word document');
  }
}

export async function parsePlainText(buffer: Buffer): Promise<string> {
  try {
    const text = buffer.toString('utf-8');
    return removeProblematicCharacters(text);
  } catch (error) {
    logger.error(`Text file parsing error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error('Failed to parse text file');
  }
}

// Supports: .xlsx
export async function parseExcelXlsx(buffer: Buffer): Promise<string> {
  try {
    // Read the Excel file from buffer
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(buffer as any);

    // Extract text from all sheets
    let extractedText = '';
    const worksheets = workbook.worksheets;

    for (const worksheet of worksheets) {
      // Add sheet name as header if there are multiple sheets
      if (worksheets.length > 1) {
        extractedText += `\n=== Sheet name: ${worksheet.name} ===\n`;
      }

      // Convert sheet to CSV format for better text representation
      const csvRows: string[] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const values = row.values as any[];
        const csvRow = values
          .slice(1) // Remove index 0 which is undefined
          .map(value => value?.toString() || '')
          .join(',');
        if (csvRow.trim()) {
          csvRows.push(csvRow);
        }
      });

      extractedText += csvRows.join('\n');

      // Add separator between sheets
      if (worksheets.length > 1) {
        extractedText += '\n';
      }
    }

    return removeProblematicCharacters(extractedText.trim());
  } catch (error) {
    logger.error(`Excel file parsing error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error('Failed to parse Excel file');
  }
}
