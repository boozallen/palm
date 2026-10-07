import type {
  ParsedSurveyRow,
  PulseFieldConfig,
  PulseResult,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type { PulseToolColumn } from '@/features/ai-agents/types/pulse/results';

// Aligns saved values to the parsed rows by row number, so every profile shares the rows' denominator.
export default function buildToolColumns(
  fields: PulseFieldConfig[],
  rows: ParsedSurveyRow[],
  results: PulseResult[],
): PulseToolColumn[] {
  const valuesByRow = new Map(results.map((result) => [
    result.rowNumber,
    new Map(result.values.map((value) => [value.fieldName, value.value])),
  ]));

  return [...fields]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((field) => ({
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      allowedValues: field.allowedValues,
      values: rows.map((row) => valuesByRow.get(row.rowNumber)?.get(field.fieldName) ?? ''),
    }));
}
