import type { PulseFieldConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';

/**
 * The survey columns a run reads, taken from the uploaded matrix instead of from the user.
 * A field naming no source columns reasons over the whole response, so one such field
 * widens the run to every column the survey has.
 */
export default function deriveInputColumns(
  fields: PulseFieldConfig[],
  availableColumns: string[],
): string[] {
  if (fields.length === 0 || fields.some((field) => field.inputColumnRefs.length === 0)) {
    return availableColumns;
  }

  const referenced = new Set(fields.flatMap((field) => field.inputColumnRefs));

  return availableColumns.filter((column) => referenced.has(column));
}
