/**
 * Utility: Parse FF Financials CSV
 *
 * Parses the auto-generated "FF Financials" flat-file CSV used by the MARGIN
 * agent. Columns are referenced by 0-based index per the spec.
 *
 * Used by: features/ai-agents/routes/margin/upload-financials.ts
 */

import { parse } from 'csv/sync';
import type { FlatFileRow } from '@/features/ai-agents/types/margin';

// Column indices (0-based)
const COL_TASK_TITLE = 2;
const COL_COSTPOINT_CLIN = 3;
const COL_TYPE = 5;
const COL_LATEST_ACTUAL = 8;
const COL_MONTH = 9;
const COL_REVENUE = 34;
const COL_PROFIT = 36;
const COL_AORP = 38;

function parseDate(raw: string): Date {
  const trimmed = raw.trim();
  return new Date(trimmed);
}

export async function parseFinancials(buffer: Buffer): Promise<FlatFileRow[]> {
  const content = buffer.toString('utf-8').replace(/^\uFEFF/, '');

  const records: string[][] = parse(content, {
    skip_empty_lines: true,
    relax_column_count: true,
  });

  if (records.length < 2) {
    throw new Error('File contains no data rows.');
  }

  const rows: FlatFileRow[] = [];

  // Skip header row (index 0)
  for (let i = 1; i < records.length; i++) {
    const record = records[i];

    const aorP = (record[COL_AORP] ?? '').trim();
    if (aorP === 'CTD Planned') {
      continue;
    }

    const costpointClin = (record[COL_COSTPOINT_CLIN] ?? '').trim();
    const taskOrder = costpointClin.slice(0, 11);
    const clin = costpointClin.slice(-4);

    const taskTitle = (record[COL_TASK_TITLE] ?? '').trim();
    const type = (record[COL_TYPE] ?? '').trim();

    const latestActualRaw = (record[COL_LATEST_ACTUAL] ?? '').trim();
    const monthRaw = (record[COL_MONTH] ?? '').trim();

    if (!latestActualRaw || !monthRaw) {
      continue;
    }

    const latestActual = parseDate(latestActualRaw);
    const month = parseDate(monthRaw);

    if (isNaN(latestActual.getTime()) || isNaN(month.getTime())) {
      continue;
    }

    const revenue = parseFloat((record[COL_REVENUE] ?? '0').replace(/,/g, ''));
    const profit = parseFloat((record[COL_PROFIT] ?? '0').replace(/,/g, ''));

    const marginPct = revenue !== 0 ? (profit / revenue) * 100 : 0;

    const jobKey = `${taskOrder}__${clin}`;

    rows.push({
      jobKey,
      taskOrder,
      clin,
      taskTitle,
      type,
      latestActual,
      month,
      revenue,
      profit,
      aorP,
      marginPct,
      csvRowNumber: i + 1,
    });
  }

  return rows;
}
