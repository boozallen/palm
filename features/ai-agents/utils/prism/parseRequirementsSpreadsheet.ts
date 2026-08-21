import * as Excel from 'exceljs';

import logger from '@/server/logger';
import type { ParsedRequirement } from '@/features/ai-agents/types/prism/complianceResult';

const HEADER_VALUES = new Set(['requirement']);

function extractCellText(cellValue: Excel.CellValue): string {
  if (!cellValue) {
    return '';
  }
  if (typeof cellValue === 'string') {
    return cellValue;
  }
  // Rich text cell — concatenate all text segments
  if (typeof cellValue === 'object' && 'richText' in cellValue) {
    return (cellValue as Excel.CellRichTextValue).richText.map((rt) => rt.text).join('');
  }
  return String(cellValue);
}

export async function parseRequirementsSpreadsheet(buffer: Buffer): Promise<ParsedRequirement[]> {
  const workbook = new Excel.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (error) {
    logger.error('Error parsing requirements spreadsheet: ', error);
    throw new Error('Failed to parse requirements spreadsheet. Please ensure it is a valid .xlsx file.');
  }

  const sheetsWithData: Array<{ name: string; requirements: string[] }> = [];

  for (const worksheet of workbook.worksheets) {
    let requirementColIndex: number | null = null;
    const requirements: string[] = [];

    // Only check the first row for the Requirement header — sheets where it
    // appears elsewhere in the body are not requirements sheets
    const firstRow = worksheet.getRow(1);
    const firstRowValues = firstRow.values as Excel.CellValue[];
    for (let i = 1; i < firstRowValues.length; i++) {
      const text = extractCellText(firstRowValues[i]).trim().toLowerCase();
      if (HEADER_VALUES.has(text)) {
        requirementColIndex = i;
        break;
      }
    }

    if (requirementColIndex === null) {
      continue;
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) {
        return; // skip the header row itself
      }
      const value = extractCellText(row.getCell(requirementColIndex!).value).trim();
      if (value) {
        requirements.push(value);
      }
    });

    if (requirements.length > 0) {
      sheetsWithData.push({ name: worksheet.name, requirements });
    }
  }

  if (sheetsWithData.length === 0) {
    throw new Error(
      'No requirements found. Each sheet must have a column named "Requirement" followed by requirement text.',
    );
  }

  const useCategory = sheetsWithData.length > 1;
  const allRequirements: ParsedRequirement[] = [];

  for (const sheet of sheetsWithData) {
    for (const requirement of sheet.requirements) {
      allRequirements.push({
        category: useCategory ? sheet.name : null,
        requirement,
      });
    }
  }

  logger.info('Parsed requirements spreadsheet', {
    sheetCount: sheetsWithData.length,
    totalRequirements: allRequirements.length,
  });

  return allRequirements;
}
