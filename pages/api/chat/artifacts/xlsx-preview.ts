import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';
import * as ExcelJS from 'exceljs';

import { authOptions } from '@/server/auth-adapter';
import { logger } from '@/server/logger';
import db from '@/server/db';
import { withErrorReporting } from '@/server/withErrorReporting';

type CellData = {
  value: string;
  bgColor: string | null;
  textColor: string | null;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  colSpan?: number;
};

type SheetData = {
  name: string;
  rows: (CellData | null)[][];
  colCount: number;
};

function colorToHex(color: ExcelJS.Color | undefined): string | null {
  if (!color) {
    return null;
  }
  if (color.argb) {
    // ARGB format: AARRGGBB — skip fully transparent or default black
    if (color.argb === 'FF000000' || color.argb === '00000000') {
      return null;
    }
    return `#${color.argb.slice(2)}`;
  }
  return null;
}

function autoContrastColor(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function formatCellValue(cell: ExcelJS.Cell): string {
  const { value, numFmt } = cell;
  if (value === null || value === undefined) {
    return '';
  }
  // Formula cells: use the cached result if present
  if (typeof value === 'object' && 'formula' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    if (result === null || result === undefined) {
      return '';
    }
    return formatNumber(Number(result), numFmt);
  }
  if (typeof value === 'number') {
    return formatNumber(value, numFmt);
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('en-US');
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
  }
  return String(value);
}

function formatNumber(num: number, numFmt: string | undefined): string {
  if (!numFmt) {
    return String(num);
  }
  if (numFmt.includes('$') || numFmt.includes('"$"')) {
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (numFmt.includes('%')) {
    return (num * 100).toFixed(2) + '%';
  }
  return String(num);
}

function colLetterToIndex(col: string): number {
  let idx = 0;
  for (const ch of col.toUpperCase()) {
    idx = idx * 26 + ch.charCodeAt(0) - 64;
  }
  return idx; // 1-based
}

function colIndexToLetter(n: number): string {
  let s = '';
  let idx = n;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    idx = Math.floor((idx - 1) / 26);
  }
  return s;
}

// Two-pass evaluator for the formula patterns openpyxl writes but doesn't cache.
// Builds a plain number map first so pass-2 SUM can read pass-1 results reliably.
function evaluateUncachedFormulas(ws: ExcelJS.Worksheet): void {
  const arithRe = /^([A-Z]+)(\d+)\s*\*\s*(?:([A-Z]+)(\d+)|([\d.]+))$/i;
  const sumRe = /^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i;

  // Build a key→number map of all plain (non-formula) numeric cells first
  const numMap = new Map<string, number>();
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    row.eachCell({ includeEmpty: false }, (cell, cn) => {
      const v = cell.value;
      if (typeof v === 'number') {
        numMap.set(`${rn}:${cn}`, v);
      }
    });
  });

  const getNum = (row: number, col: number): number => numMap.get(`${row}:${col}`) ?? 0;

  // Pass 1: arithmetic  =B2*C2  or  =D2*0.10
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    row.eachCell({ includeEmpty: false }, (cell, cn) => {
      const v = cell.value;
      if (!v || typeof v !== 'object' || !('formula' in v)) {
        return;
      }
      const fv = v as ExcelJS.CellFormulaValue;
      const m = arithRe.exec(fv.formula.trim());
      if (!m) {
        return;
      }
      const left = getNum(parseInt(m[2]), colLetterToIndex(m[1]));
      const right = m[5] !== undefined
        ? parseFloat(m[5])
        : getNum(parseInt(m[4] ?? '0'), colLetterToIndex(m[3] ?? 'A'));
      const result = left * right;
      cell.value = { formula: fv.formula, result } as ExcelJS.CellFormulaValue;
      numMap.set(`${rn}:${cn}`, result);
    });
  });

  // Pass 2: SUM ranges — numMap now includes pass-1 results
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    row.eachCell({ includeEmpty: false }, (cell, cn) => {
      const v = cell.value;
      if (!v || typeof v !== 'object' || !('formula' in v)) {
        return;
      }
      const fv = v as ExcelJS.CellFormulaValue;
      const m = sumRe.exec(fv.formula.trim());
      if (!m) {
        return;
      }
      const colStart = colLetterToIndex(m[1]);
      const rowStart = parseInt(m[2]);
      const colEnd = colLetterToIndex(m[3]);
      const rowEnd = parseInt(m[4]);
      let sum = 0;
      for (let r = rowStart; r <= rowEnd; r++) {
        for (let c = colStart; c <= colEnd; c++) {
          sum += getNum(r, c);
        }
      }
      cell.value = { formula: fv.formula, result: sum } as ExcelJS.CellFormulaValue;
      numMap.set(`${rn}:${cn}`, sum);
    });
  });

  void colIndexToLetter;
}

async function parseXlsx(buffer: Buffer): Promise<SheetData[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets: SheetData[] = [];

  wb.eachSheet((ws) => {
    evaluateUncachedFormulas(ws);
    let maxCol = 0;
    const rowMap: Map<number, Map<number, CellData>> = new Map();

    // Build merge lookup: "row:col" → colSpan for top-left cell, null for spanned cells
    type MergeInfo = { colSpan: number } | null;
    const mergeMap = new Map<string, MergeInfo>();
    const model = ws.model as { merges?: string[] };
    for (const range of model.merges ?? []) {
      // range is like "A1:D1"
      const [start, end] = range.split(':');
      if (!start || !end) {
        continue;
      }
      const parseAddr = (addr: string): [number, number] => {
        const m = /^([A-Z]+)(\d+)$/i.exec(addr);
        if (!m) { return [0, 0]; }
        return [parseInt(m[2]), colLetterToIndex(m[1])];
      };
      const [rStart, cStart] = parseAddr(start);
      const [rEnd, cEnd] = parseAddr(end);
      const colSpan = cEnd - cStart + 1;
      for (let r = rStart; r <= rEnd; r++) {
        for (let c = cStart; c <= cEnd; c++) {
          if (r === rStart && c === cStart) {
            mergeMap.set(`${r}:${c}`, { colSpan });
          } else {
            mergeMap.set(`${r}:${c}`, null);
          }
        }
      }
    }

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const colMap: Map<number, CellData> = new Map();
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > maxCol) {
          maxCol = colNumber;
        }
        const mergeInfo = mergeMap.get(`${rowNumber}:${colNumber}`);
        // Skip spanned (non-top-left) merge cells — rendered as null below
        if (mergeInfo === null) {
          return;
        }
        const fill = cell.fill as ExcelJS.FillPattern | undefined;
        const bgColor = fill?.type === 'pattern' && fill.fgColor ? colorToHex(fill.fgColor as ExcelJS.Color) : null;
        const rawTextColor = cell.font?.color ? colorToHex(cell.font.color as ExcelJS.Color) : null;
        const textColor = rawTextColor ?? (bgColor ? autoContrastColor(bgColor) : null);
        const align = cell.alignment?.horizontal;

        colMap.set(colNumber, {
          value: formatCellValue(cell),
          bgColor,
          textColor,
          bold: cell.font?.bold ?? false,
          italic: cell.font?.italic ?? false,
          align: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
          ...(mergeInfo ? { colSpan: mergeInfo.colSpan } : {}),
        });
      });
      rowMap.set(rowNumber, colMap);
    });

    if (rowMap.size === 0) {
      sheets.push({ name: ws.name, rows: [], colCount: 0 });
      return;
    }

    const minRow = Math.min(...rowMap.keys());
    const maxRow = Math.max(...rowMap.keys());
    const rows: (CellData | null)[][] = [];

    for (let r = minRow; r <= maxRow; r++) {
      const colMap = rowMap.get(r);
      const row: (CellData | null)[] = [];
      for (let c = 1; c <= maxCol; c++) {
        const mergeInfo = mergeMap.get(`${r}:${c}`);
        // Spanned cells render as null (the colSpan on the top-left cell covers them)
        if (mergeInfo === null) {
          row.push(null);
          continue;
        }
        row.push(colMap?.get(c) ?? { value: '', bgColor: null, textColor: null, bold: false, italic: false, align: 'left' });
      }
      rows.push(row);
    }

    sheets.push({ name: ws.name, rows, colCount: maxCol });
  });

  return sheets;
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, await authOptions());
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const artifactId = typeof req.query['id'] === 'string' ? req.query['id'] : '';
  if (!artifactId) {
    res.status(400).json({ error: 'Missing required query parameter: id' });
    return;
  }

  try {
    const results = await db.$queryRaw<Array<{
      binaryContent: Buffer | null;
    }>>`
      SELECT a."binaryContent"
      FROM "ChatArtifact" a
      JOIN "ChatMessage" m ON m.id = a."chatMessageId"
      JOIN "Chat" c ON c.id = m."chatId"
      WHERE a.id = ${artifactId}::uuid
        AND c."userId" = ${session.user.id}::uuid
        AND a."fileExtension" = '.xlsx'
      LIMIT 1
    `;

    const artifact = results[0];
    if (!artifact?.binaryContent) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    const buffer = Buffer.isBuffer(artifact.binaryContent)
      ? artifact.binaryContent
      : Buffer.from(artifact.binaryContent);

    const sheets = await parseXlsx(buffer);
    res.status(200).json({ sheets });
  } catch (error) {
    logger.error('[XLSX-PREVIEW] Failed to parse artifact:', error);
    res.status(500).json({ error: 'Failed to parse spreadsheet' });
  }
};

export default withErrorReporting(handler);
