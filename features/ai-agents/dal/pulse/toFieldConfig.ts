import {
  PulseFieldType,
  type PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

type FieldRecord = {
  fieldName: string;
  prompt: string;
  fieldType: string;
  allowedValues: string[];
  defaultValue: string | null;
  inputColumnRefs: string[];
  sortOrder: number;
};

// fieldType is a plain column, so narrow it back to the enum on the way out of the DB.
export default function toFieldConfig(record: FieldRecord): PulseFieldConfig {
  const fieldType = Object.values(PulseFieldType).includes(record.fieldType as PulseFieldType)
    ? (record.fieldType as PulseFieldType)
    : PulseFieldType.FREE_TEXT;

  return {
    fieldName: record.fieldName,
    prompt: record.prompt,
    fieldType,
    allowedValues: record.allowedValues,
    defaultValue: record.defaultValue,
    inputColumnRefs: record.inputColumnRefs,
    sortOrder: record.sortOrder,
  };
}
