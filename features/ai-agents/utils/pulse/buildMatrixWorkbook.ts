import * as ExcelJS from 'exceljs';

import { formatColumnLetters } from '@/features/ai-agents/utils/pulse/columnLetters';
import {
  MATRIX_FALLBACK_VALUE,
  MATRIX_SHEET_NAME,
} from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import {
  PulseFieldType,
  type PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// One example of each derived field type, so the template teaches the rules by showing them.
const EXAMPLE_FIELDS: PulseFieldConfig[] = [
  {
    fieldName: 'Sentiment',
    prompt: 'Read the response and choose how the respondent feels about the session overall.',
    fieldType: PulseFieldType.CATEGORY,
    allowedValues: ['Positive', 'Neutral', 'Negative'],
    defaultValue: MATRIX_FALLBACK_VALUE,
    inputColumnRefs: ['B'],
    sortOrder: 0,
  },
  {
    fieldName: 'Main concern',
    prompt: 'Summarize the respondent\'s main concern in under 12 words. Leave the allowed values cell empty for free-text answers like this one.',
    fieldType: PulseFieldType.FREE_TEXT,
    allowedValues: [],
    defaultValue: MATRIX_FALLBACK_VALUE,
    inputColumnRefs: ['B', 'C'],
    sortOrder: 1,
  },
  {
    fieldName: 'Training gap',
    prompt: 'Rate how large a training gap the response describes, where 1 is none and 5 is severe.',
    fieldType: PulseFieldType.SCALE,
    allowedValues: ['1', '2', '3', '4', '5'],
    defaultValue: MATRIX_FALLBACK_VALUE,
    inputColumnRefs: ['C', 'D'],
    sortOrder: 2,
  },
];

/**
 * Renders output columns as the prompt matrix workbook `parsePromptMatrix` reads back.
 *
 * Empty `fields` produces the blank template, which carries the example rows above so
 * nobody has to guess the format. A round-trip test pins the two together.
 */
export default async function buildMatrixWorkbook(fields: PulseFieldConfig[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(MATRIX_SHEET_NAME);

  sheet.columns = [
    { header: 'Column name', key: 'fieldName', width: 28 },
    { header: 'Source columns', key: 'sourceColumns', width: 18 },
    { header: 'Prompt', key: 'prompt', width: 90 },
    { header: 'Allowed values', key: 'allowedValues', width: 34 },
  ];

  sheet.getRow(1).font = { bold: true };

  const rows = fields.length > 0 ? fields : EXAMPLE_FIELDS;

  rows.forEach((field) => {
    const row = sheet.addRow({
      fieldName: field.fieldName,
      sourceColumns: formatColumnLetters(field.inputColumnRefs),
      prompt: field.prompt,
      allowedValues: field.allowedValues.join('\n'),
    });

    row.getCell('allowedValues').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('prompt').alignment = { wrapText: true, vertical: 'top' };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Blob([buffer], { type: XLSX_MIME_TYPE });
}
