import * as ExcelJS from 'exceljs';

import type {
  PromptMatrixData,
  PromptMatrixQuestion,
} from '@/features/ai-agents/types/odram/promptMatrix';

/**
 * Prompt Matrix spreadsheet layout (sheet "Prompts"):
 *
 * Row 2:   Question names (cols B–AB = columns 2–28, one per question)
 * Row 19:  Extraction instructions (per-question)
 * Row 22:  Persona (shared — column B)
 * Row 25:  Objective (per-question)
 * Row 28:  Step 1 intro (shared — column B)
 * Row 29:  Risk definition — Low (per-question)
 * Row 30:  Risk definition — Moderate (per-question)
 * Row 31:  Risk definition — High (per-question)
 * Row 34:  Step 2 intro (shared — column B)
 * Row 35:  Handbook guidance (per-question)
 * Row 38:  Response guidelines (shared — column B)
 */

const ROW_QUESTION_NAME = 2;
const ROW_EXTRACTION_INSTRUCTIONS = 19;
const ROW_PERSONA = 22;
const ROW_OBJECTIVE = 25;
const ROW_STEP1_INTRO = 28;
const ROW_RISK_LOW = 29;
const ROW_RISK_MODERATE = 30;
const ROW_RISK_HIGH = 31;
const ROW_STEP2_INTRO = 34;
const ROW_HANDBOOK_GUIDANCE = 35;
const ROW_RESPONSE_GUIDELINES = 38;

/** First question column (B = index 2) */
const FIRST_COL = 2;
/** Last question column (AB = index 28) */
const MAX_COL = 28;

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join('');
  }
  return String(value).trim();
}

/**
 * Parses the Prompt Matrix xlsx into structured data for dynamic prompt assembly.
 *
 * Reads the "Prompts" sheet. Per-question data lives in columns B–AB (up to 27 questions).
 * Shared sections are read from column B of their respective rows.
 */
export default async function parsePromptMatrix(
  buffer: Buffer,
): Promise<PromptMatrixData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.getWorksheet('Prompts') ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error('No worksheet found in Prompt Matrix spreadsheet');
  }

  const getCell = (row: number, col: number): string =>
    cellToString(sheet.getRow(row).getCell(col).value);

  // Shared sections (column B = index 2)
  const persona = getCell(ROW_PERSONA, FIRST_COL);
  const step1Intro = getCell(ROW_STEP1_INTRO, FIRST_COL);
  const step2Intro = getCell(ROW_STEP2_INTRO, FIRST_COL);
  const responseGuidelines = getCell(ROW_RESPONSE_GUIDELINES, FIRST_COL);

  // Per-question data from columns B–AB
  const questions: PromptMatrixQuestion[] = [];

  for (let col = FIRST_COL; col <= MAX_COL; col++) {
    const name = getCell(ROW_QUESTION_NAME, col);
    if (!name) {
      continue; // skip empty columns
    }

    questions.push({
      id: questions.length + 1,
      name,
      objective: getCell(ROW_OBJECTIVE, col),
      extractionInstructions: getCell(ROW_EXTRACTION_INSTRUCTIONS, col),
      riskDefinitions: {
        low: getCell(ROW_RISK_LOW, col),
        moderate: getCell(ROW_RISK_MODERATE, col),
        high: getCell(ROW_RISK_HIGH, col),
      },
      handbookGuidance: getCell(ROW_HANDBOOK_GUIDANCE, col),
    });
  }

  if (questions.length === 0) {
    throw new Error('No questions found in Prompt Matrix (row 2, columns B–AB are empty)');
  }

  return {
    persona,
    step1Intro,
    step2Intro,
    responseGuidelines,
    questions,
  };
}
