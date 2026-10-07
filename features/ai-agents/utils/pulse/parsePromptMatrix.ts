import * as ExcelJS from 'exceljs';

import loadWorkbook from '@/features/ai-agents/utils/pulse/loadWorkbook';
import {
  fallbackIsAllowedValueError,
  formatPulseError,
  matrixMissingHeaderError,
  matrixNoUsableRowsError,
  matrixTooManyColumnsError,
  type PulseError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import { cellToString } from '@/features/ai-agents/utils/pulse/readSurveyRows';
import resolveSourceColumns from '@/features/ai-agents/utils/pulse/resolveSourceColumns';
import {
  PulseFieldType,
  type PulseFieldConfig,
  type PulseSurveyHeader,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

export const MATRIX_SHEET_NAME = 'Prompt Matrix';
// The fallback written into a cell the model could not fill. Deliberately not an
// allowed value, so a failure never shares a bucket with a real answer.
export const MATRIX_FALLBACK_VALUE = 'Not determined';
export const MATRIX_MAX_FIELDS = 25;

const MAX_ALLOWED_VALUES = 50;
const MAX_FIELD_NAME_LENGTH = 100;
const MAX_PROMPT_LENGTH = 4000;
const HEADER_SCAN_ROWS = 10;
const NUMERIC_VALUE = /^[+-]?\d+(\.\d+)?$/;
const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['\'', '\''],
  ['"', '"'],
  ['‘', '’'],
  ['“', '”'],
];

const HEADER_SYNONYMS = {
  fieldName: ['columnname', 'newcolumn', 'outputcolumn', 'name'],
  sourceColumns: ['sourcecolumns', 'sourcecolumn', 'source', 'inputcolumns'],
  prompt: ['prompt', 'instruction', 'instructions', 'analysis'],
  allowedValues: ['allowedvalues', 'allowed', 'values', 'options'],
} as const;

// The template's own header text, named in the missing-header error.
const FIELD_NAME_HEADER = 'Column name';
const PROMPT_HEADER = 'Prompt';

type HeaderKey = keyof typeof HEADER_SYNONYMS;
type HeaderPositions = Partial<Record<HeaderKey, number>>;

export type PromptMatrixRowError = { row: number; message: string };

export type PromptMatrixParse = {
  fields: PulseFieldConfig[];
  rowErrors: PromptMatrixRowError[];
  fileError: string | null;
};

type HeaderScan =
  | { found: true; row: number; positions: HeaderPositions }
  | { found: false; missingHeader: string; foundHeaders: string[] };

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Names a header cell by the longest synonym it contains, so hand-authored variants like
// "New Column Name" or "Source Column Letter(s)" resolve, and the longest match decides
// when one cell contains synonyms of two different columns.
function headerKeyFor(normalized: string): HeaderKey | null {
  if (normalized.length === 0) {
    return null;
  }

  let matchedKey: HeaderKey | null = null;
  let matchedLength = 0;

  for (const key of Object.keys(HEADER_SYNONYMS) as HeaderKey[]) {
    for (const synonym of HEADER_SYNONYMS[key]) {
      if (normalized.includes(synonym) && synonym.length > matchedLength) {
        matchedKey = key;
        matchedLength = synonym.length;
      }
    }
  }

  return matchedKey;
}

function findSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const target = normalizeHeader(MATRIX_SHEET_NAME);
  const named = workbook.worksheets.find((sheet) => normalizeHeader(sheet.name) === target);

  return named ?? workbook.worksheets[0] ?? null;
}

// Finds the header row, or, when none has both required columns, the row that came closest
// (most recognized columns, earliest on a tie) so the error can say what it found there.
function scanHeaderRow(sheet: ExcelJS.Worksheet): HeaderScan {
  const lastRow = Math.min(sheet.rowCount, HEADER_SCAN_ROWS);
  const keys = Object.keys(HEADER_SYNONYMS) as HeaderKey[];
  let best: { row: number; positions: HeaderPositions; score: number } | null = null;
  let closest: { positions: HeaderPositions; texts: string[]; score: number } | null = null;

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber++) {
    const positions: HeaderPositions = {};
    const texts: string[] = [];

    sheet.getRow(rowNumber).eachCell((cell, colNumber) => {
      const text = cellToString(cell.value);
      const key = headerKeyFor(normalizeHeader(text));

      if (text.length > 0) {
        texts.push(text);
      }
      if (key !== null && positions[key] === undefined) {
        positions[key] = colNumber;
      }
    });

    const score = keys.filter((key) => positions[key] !== undefined).length;

    if (texts.length > 0 && (!closest || score > closest.score)) {
      closest = { positions, texts, score };
    }

    if (positions.fieldName === undefined || positions.prompt === undefined) {
      continue;
    }

    // A real header names more of the four columns than a data row can coincidentally match.
    if (!best || score > best.score) {
      best = { row: rowNumber, positions, score };
    }
  }

  if (best) {
    return { found: true, row: best.row, positions: best.positions };
  }

  return {
    found: false,
    missingHeader: closest?.positions.fieldName === undefined ? FIELD_NAME_HEADER : PROMPT_HEADER,
    foundHeaders: closest?.texts ?? [],
  };
}

// Newline and pipe exist so a legitimate value can contain a comma.
function allowedValuesDelimiter(raw: string): string {
  if (raw.includes('\n')) {
    return '\n';
  }
  if (raw.includes('|')) {
    return '|';
  }
  return ',';
}

// A value pasted from a document arrives wrapped in quotes the model's answer never contains.
function stripWrappingQuotes(value: string): string {
  const pair = QUOTE_PAIRS.find(([open, close]) => (
    value.length > 1 && value.startsWith(open) && value.endsWith(close)
  ));

  return pair ? value.slice(1, -1).trim() : value;
}

function splitAllowedValues(raw: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const token of raw.split(allowedValuesDelimiter(raw))) {
    const value = stripWrappingQuotes(token.trim());

    if (value.length === 0 || seen.has(value.toLowerCase())) {
      continue;
    }

    seen.add(value.toLowerCase());
    values.push(value);
  }

  return values;
}

function deriveFieldType(allowedValues: string[]): PulseFieldType {
  if (allowedValues.length === 0) {
    return PulseFieldType.FREE_TEXT;
  }
  if (allowedValues.every((value) => NUMERIC_VALUE.test(value))) {
    return PulseFieldType.SCALE;
  }
  return PulseFieldType.CATEGORY;
}

type RowCandidate = {
  fieldName: string;
  prompt: string;
  allowedValues: string[];
  sourceText: string;
  inputColumnRefs: string[];
  sourceError: PulseError | null;
};

function rowErrorMessage(candidate: RowCandidate, seenNames: Set<string>): string | null {
  const { fieldName, prompt, allowedValues, sourceError } = candidate;

  if (fieldName.length === 0) {
    return 'This row has no column name.';
  }
  if (seenNames.has(fieldName.toLowerCase())) {
    return `"${fieldName}" is already used by an earlier row. Each output column needs a distinct name.`;
  }
  if (fieldName.length > MAX_FIELD_NAME_LENGTH) {
    return `Keep the column name under ${MAX_FIELD_NAME_LENGTH} characters.`;
  }
  if (prompt.length === 0) {
    return `"${fieldName}" has no prompt. Describe what this column should contain.`;
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return `Keep the prompt for "${fieldName}" under ${MAX_PROMPT_LENGTH} characters.`;
  }
  if (allowedValues.length > MAX_ALLOWED_VALUES) {
    return `"${fieldName}" has more than ${MAX_ALLOWED_VALUES} allowed values.`;
  }
  if (allowedValues.some((value) => value.toLowerCase() === MATRIX_FALLBACK_VALUE.toLowerCase())) {
    return formatPulseError(fallbackIsAllowedValueError(fieldName, MATRIX_FALLBACK_VALUE));
  }
  if (sourceError) {
    return formatPulseError(sourceError);
  }

  return null;
}

/**
 * Reads an uploaded prompt matrix into the output columns a run is configured with.
 *
 * Only an unreadable workbook throws. Everything a user can fix in their spreadsheet
 * comes back as a row error carrying the worksheet row number, or a file error, so the
 * upload screen can show every problem at once instead of one per attempt.
 * `surveyHeaders` empty means no survey is loaded yet: source letters are accepted
 * provisionally and source names wait for the re-parse that loading a survey triggers.
 */
export default async function parsePromptMatrix(
  file: File,
  surveyHeaders: PulseSurveyHeader[],
): Promise<PromptMatrixParse> {
  let workbook;

  try {
    workbook = await loadWorkbook(await file.arrayBuffer());
  } catch {
    throw new Error('Failed to read the prompt matrix workbook. Please ensure it is a valid .xlsx file.');
  }

  const sheet = findSheet(workbook);

  if (!sheet) {
    return { fields: [], rowErrors: [], fileError: 'The prompt matrix workbook has no worksheets.' };
  }

  const header = scanHeaderRow(sheet);

  if (!header.found) {
    return {
      fields: [],
      rowErrors: [],
      fileError: formatPulseError(matrixMissingHeaderError(header.missingHeader, header.foundHeaders)),
    };
  }

  const { row: headerRow, positions } = header;
  const fields: PulseFieldConfig[] = [];
  const rowErrors: PromptMatrixRowError[] = [];
  const seenNames = new Set<string>();
  let validRowCount = 0;

  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const sheetRow = sheet.getRow(rowNumber);

    const readCell = (key: HeaderKey): string => {
      const column = positions[key];
      return column === undefined ? '' : cellToString(sheetRow.getCell(column).value).trim();
    };

    const sourceText = readCell('sourceColumns');
    const sources = resolveSourceColumns(sourceText, surveyHeaders);

    const candidate: RowCandidate = {
      fieldName: readCell('fieldName'),
      prompt: readCell('prompt'),
      allowedValues: splitAllowedValues(readCell('allowedValues')),
      sourceText,
      inputColumnRefs: sources.letters,
      sourceError: sources.error,
    };

    const isBlank = candidate.fieldName.length === 0
      && candidate.prompt.length === 0
      && candidate.allowedValues.length === 0
      && candidate.sourceText.length === 0;

    if (isBlank) {
      continue;
    }

    const message = rowErrorMessage(candidate, seenNames);

    if (message) {
      rowErrors.push({ row: rowNumber, message });
      continue;
    }

    seenNames.add(candidate.fieldName.toLowerCase());
    validRowCount += 1;

    if (fields.length >= MATRIX_MAX_FIELDS) {
      continue;
    }

    fields.push({
      fieldName: candidate.fieldName,
      prompt: candidate.prompt,
      fieldType: deriveFieldType(candidate.allowedValues),
      allowedValues: candidate.allowedValues,
      defaultValue: MATRIX_FALLBACK_VALUE,
      inputColumnRefs: candidate.inputColumnRefs,
      sortOrder: fields.length,
    });
  }

  if (fields.length === 0 && rowErrors.length === 0) {
    return { fields: [], rowErrors: [], fileError: formatPulseError(matrixNoUsableRowsError()) };
  }

  const fileError = validRowCount > MATRIX_MAX_FIELDS
    ? formatPulseError(matrixTooManyColumnsError(validRowCount, MATRIX_MAX_FIELDS))
    : null;

  return { fields, rowErrors, fileError };
}
