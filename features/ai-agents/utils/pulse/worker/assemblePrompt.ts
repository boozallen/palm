import { z } from 'zod';

import { getPulseSystemPrompt } from '@/features/ai-agents/data/pulse/prompts';
import { ROW_DATA_NOTICE, fenceData } from '@/features/ai-agents/utils/pulse/worker/dataFence';
import {
  PulseFieldType,
  type ParsedSurveyRow,
  type PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

export { getPulseSystemPrompt };

// Column letters are included so a field's scoping instruction can refer to them.
export function buildRowContext(row: ParsedSurveyRow, columns: string[]): string {
  const letters = columns.length > 0 ? columns : Object.keys(row.cells);

  return letters
    .map((letter) => row.cells[letter])
    .filter((cell) => Boolean(cell))
    .map((cell) => `[${cell.column}] ${cell.header}:\n${cell.value}`)
    .join('\n\n');
}

// Fenced so a crafted answer cannot close the response section and open a fake instruction one.
function fencedRowContext(row: ParsedSurveyRow, columns: string[]): string {
  const context = buildRowContext(row, columns);

  return context.length === 0 ? '' : [ROW_DATA_NOTICE, fenceData(context)].join('\n');
}

/**
 * The columns one call is allowed to see: the union of what its fields ask for. A field that
 * names no source columns reasons over the whole response, so one such field opens the call
 * up to every column.
 */
export function scopeColumnsFor(fields: PulseFieldConfig[]): string[] {
  if (fields.some((field) => field.inputColumnRefs.length === 0)) {
    return [];
  }

  return Array.from(new Set(fields.flatMap((field) => field.inputColumnRefs)));
}

/**
 * Fields reading the same columns are derived together. Splitting the row this way is what
 * makes a field's source columns a boundary rather than a request: a field never sees a
 * column it was not pointed at, so it cannot answer from one.
 */
export function groupFieldsByScope(fields: PulseFieldConfig[]): PulseFieldConfig[][] {
  const groups = new Map<string, PulseFieldConfig[]>();

  fields.forEach((field) => {
    const key = field.inputColumnRefs.length === 0
      ? '*'
      : [...field.inputColumnRefs].sort().join(',');

    groups.set(key, [...(groups.get(key) ?? []), field]);
  });

  return Array.from(groups.values());
}

// Whether a row has anything to read in the columns a call is scoped to.
export function hasScopedContent(row: ParsedSurveyRow, columns: string[]): boolean {
  const letters = columns.length > 0 ? columns : Object.keys(row.cells);

  return letters.some((letter) => (row.cells[letter]?.value ?? '').trim().length > 0);
}

export function buildFieldInstruction(field: PulseFieldConfig): string {
  const lines = [`Field "${field.fieldName}" (type: ${field.fieldType})`, field.prompt];

  if (field.allowedValues.length > 0) {
    lines.push(`Allowed values — return exactly one of these, verbatim: ${field.allowedValues.join(' | ')}`);
  }

  if (field.inputColumnRefs.length > 0) {
    lines.push(`Derive this field only from column(s) ${field.inputColumnRefs.join(', ')}; ignore the rest of the response.`);
  }

  return lines.join('\n');
}

export function assembleRowPrompt(
  row: ParsedSurveyRow,
  fields: PulseFieldConfig[],
): string {
  const keys = fields.map((field) => `"${field.fieldName}"`).join(', ');

  return [
    `--- SURVEY RESPONSE (row ${row.rowNumber}) ---`,
    fencedRowContext(row, scopeColumnsFor(fields)),
    '--- FIELDS TO DERIVE ---',
    fields.map(buildFieldInstruction).join('\n\n'),
    `--- OUTPUT FORMAT ---\nReturn ONLY a JSON object with exactly these keys: ${keys}. Every key must be present with a non-empty string value. Do not add keys, commentary, or markdown fences.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Prompt for retrying one field in isolation. Presents only that field's
 * referenced columns, so a single-column analysis is not diluted by the rest
 * of the row on the attempt that matters most.
 */
export function assembleFieldPrompt(
  row: ParsedSurveyRow,
  field: PulseFieldConfig,
): string {
  return [
    `--- SURVEY RESPONSE (row ${row.rowNumber}) ---`,
    fencedRowContext(row, field.inputColumnRefs),
    '--- FIELD TO DERIVE ---',
    buildFieldInstruction(field),
    `--- OUTPUT FORMAT ---\nReturn ONLY a JSON object of the form {"${field.fieldName}": "<value>"}. No commentary, no markdown fences.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function validateFieldValue(
  field: PulseFieldConfig,
  raw: unknown,
): { ok: true; value: string } | { ok: false; reason: string } {
  const parsed = z.string().safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: 'Value was not a string' };
  }

  const value = parsed.data.trim();

  if (field.fieldType === PulseFieldType.FREE_TEXT) {
    if (value.length === 0) {
      return { ok: false, reason: 'Value was empty' };
    }
    return { ok: true, value };
  }

  if (field.allowedValues.length === 0) {
    return { ok: false, reason: 'No allowed values are configured for this field' };
  }

  const match = field.allowedValues.find(
    (allowed) => allowed.toLowerCase() === value.toLowerCase(),
  );

  if (!match) {
    return {
      ok: false,
      reason: `Value "${value}" is not one of: ${field.allowedValues.join(', ')}`,
    };
  }

  // Return the configured casing so stored values group cleanly in distribution counts.
  return { ok: true, value: match };
}
