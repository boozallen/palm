import * as ExcelJS from 'exceljs';

import { logger } from '@/server/logger';

type ParsedOdramResponse = {
  questionName: string;
  teamRating: string;
  teamRationale: string;
  teamMitigation: string;
  riskDefinitions: {
    low: string;
    moderate: string;
    high: string;
  };
};

/** Column where the first question's 3-column group starts (D = index 4). */
const FIRST_DATA_COL = 4;

/** Each question occupies 3 consecutive columns: rating, rationale, mitigation. */
const COLS_PER_QUESTION = 3;

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
 * Checks whether a header cell text matches a Prompt Matrix question name.
 *
 * Tries several strategies in order:
 *   1. Case-insensitive exact match
 *   2. Substring containment (either direction)
 *   3. Significant keyword overlap (2+ shared words of length > 3)
 */
function headerMatchesQuestion(header: string, questionName: string): boolean {
  const h = header.toLowerCase().trim();
  const q = questionName.toLowerCase().trim();

  if (!h) {
    return false;
  }

  // Exact
  if (h === q) {
    return true;
  }

  // Substring (either direction, min length 3 to avoid false positives)
  if (h.length > 2 && (q.includes(h) || h.includes(q))) {
    return true;
  }

  // Keyword overlap
  const hWords = h.split(/[\s/()]+/).filter((w) => w.length > 3);
  const qWords = q.split(/[\s/()]+/).filter((w) => w.length > 3);
  const overlap = hWords.filter((hw) =>
    qWords.some((qw) => hw === qw || hw.includes(qw) || qw.includes(hw)),
  );
  if (overlap.length >= 2 || (overlap.length >= 1 && hWords.length === 1)) {
    return true;
  }

  return false;
}

function readQuestionGroup(
  dataRow: ExcelJS.Row,
  col: number,
  questionName: string,
): ParsedOdramResponse {
  return {
    questionName,
    teamRating: cellToString(dataRow.getCell(col).value) || 'Not provided',
    teamRationale: cellToString(dataRow.getCell(col + 1).value) || 'Not provided',
    teamMitigation: cellToString(dataRow.getCell(col + 2).value) || 'N/A',
    riskDefinitions: { low: '', moderate: '', high: '' },
  };
}

/**
 * Strategy 1: match row-1 headers to question names.
 *
 * Scans columns starting at FIRST_DATA_COL, stepping by 3 (each question
 * group header is in the first column of its 3-column block). Returns
 * matched responses and leaves unmatched questions for the positional fallback.
 */
function matchByHeader(
  headerRow: ExcelJS.Row,
  dataRow: ExcelJS.Row,
  totalCols: number,
  questions: { id: number; name: string }[],
): ParsedOdramResponse[] {
  const responses: ParsedOdramResponse[] = [];
  const matched = new Set<number>();

  for (let col = FIRST_DATA_COL; col <= totalCols; col += COLS_PER_QUESTION) {
    const header = cellToString(headerRow.getCell(col).value);
    if (!header) {
      continue;
    }

    for (const q of questions) {
      if (matched.has(q.id)) {
        continue;
      }
      if (headerMatchesQuestion(header, q.name)) {
        matched.add(q.id);
        responses.push(readQuestionGroup(dataRow, col, q.name));
        break;
      }
    }
  }

  return responses;
}

/**
 * Strategy 2 (fallback): assume the N-th Prompt Matrix question maps to
 * the N-th 3-column group (col 4, 7, 10, …). Works with any number of
 * questions as long as the ODRAM response sheet uses the same ordering.
 */
function matchByPosition(
  dataRow: ExcelJS.Row,
  questions: { id: number; name: string }[],
): ParsedOdramResponse[] {
  return questions.map((q, i) => {
    const col = FIRST_DATA_COL + i * COLS_PER_QUESTION;
    return readQuestionGroup(dataRow, col, q.name);
  });
}

/**
 * Parses an ODRAM xlsx spreadsheet and returns structured team responses.
 *
 * Reads the "Forms" sheet. Each question occupies a 3-column group
 * (rating, rationale, mitigation). The parser first tries to match
 * row-1 headers to Prompt Matrix question names; if fewer than half
 * match it falls back to positional mapping (N-th question = N-th group).
 *
 * @param buffer - The xlsx file buffer
 * @param questionNames - Map of question ID → name from the Prompt Matrix
 */
export default async function parseOdramSpreadsheet(
  buffer: Buffer,
  questionNames: Map<number, string>,
): Promise<ParsedOdramResponse[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.getWorksheet('Forms') ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error('No worksheet found in ODRAM spreadsheet');
  }

  const headerRow = sheet.getRow(1);
  const dataRow = sheet.getRow(2);
  if (!dataRow || !dataRow.getCell(1).value) {
    throw new Error('No data row found in ODRAM spreadsheet (row 2 is empty)');
  }

  const questions = [...questionNames.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, name]) => ({ id, name }));

  // Try header-based matching first
  const headerMatched = matchByHeader(headerRow, dataRow, sheet.columnCount, questions);

  if (headerMatched.length >= questions.length / 2) {
    logger.info('ODRAM spreadsheet parsed via header matching', {
      matched: headerMatched.length,
      total: questions.length,
    });
    return headerMatched;
  }

  // Not enough header matches (e.g. abbreviation headers) — use positional
  logger.info('ODRAM spreadsheet parsed via positional mapping (header match insufficient)', {
    headerMatched: headerMatched.length,
    total: questions.length,
  });
  return matchByPosition(dataRow, questions);
}
