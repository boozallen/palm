import * as ExcelJS from 'exceljs';

type MatrixQuestionPreview = {
  id: number;
  name: string;
};

/**
 * Lightweight client-side parser for the Prompt Matrix xlsx.
 *
 * Reads only Row 2 (question names) from the "Prompts" sheet
 * to populate the DocumentPicker UI. Keeps client-side bundle
 * minimal — the full matrix is parsed server-side by the worker.
 */
export default async function parsePromptMatrixPreview(
  file: File,
): Promise<MatrixQuestionPreview[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheet = workbook.getWorksheet('Prompts') ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error('No worksheet found in Prompt Matrix file');
  }

  const nameRow = sheet.getRow(2);
  const questions: MatrixQuestionPreview[] = [];

  // Columns B–AB (indices 2–28)
  for (let col = 2; col <= 28; col++) {
    const cell = nameRow.getCell(col);
    const value = cell.value;

    let name = '';
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && 'richText' in value) {
        name = (value as ExcelJS.CellRichTextValue).richText
          .map((rt) => rt.text)
          .join('');
      } else {
        name = String(value).trim();
      }
    }

    if (!name) {
      continue;
    }

    questions.push({
      id: questions.length + 1,
      name,
    });
  }

  if (questions.length === 0) {
    throw new Error('No question names found in Prompt Matrix (row 2, columns B–AB are empty)');
  }

  return questions;
}
