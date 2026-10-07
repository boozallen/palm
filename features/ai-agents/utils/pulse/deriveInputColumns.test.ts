import deriveInputColumns from '@/features/ai-agents/utils/pulse/deriveInputColumns';
import { PulseFieldType, type PulseFieldConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';

const AVAILABLE = ['A', 'B', 'C', 'D', 'E'];

function field(fieldName: string, inputColumnRefs: string[]): PulseFieldConfig {
  return {
    fieldName,
    prompt: 'Describe it.',
    fieldType: PulseFieldType.FREE_TEXT,
    allowedValues: [],
    defaultValue: MATRIX_FALLBACK_VALUE,
    inputColumnRefs,
    sortOrder: 0,
  };
}

describe('deriveInputColumns', () => {
  it('reads only the columns the matrix names', () => {
    const fields = [field('Speaker', ['D']), field('Topic', ['B'])];

    expect(deriveInputColumns(fields, AVAILABLE)).toEqual(['B', 'D']);
  });

  it('orders the columns by the survey, not by the matrix', () => {
    const fields = [field('Speaker', ['E', 'B']), field('Topic', ['C'])];

    expect(deriveInputColumns(fields, AVAILABLE)).toEqual(['B', 'C', 'E']);
  });

  it('lists a column once when two fields both read it', () => {
    const fields = [field('Speaker', ['B']), field('Topic', ['B'])];

    expect(deriveInputColumns(fields, AVAILABLE)).toEqual(['B']);
  });

  it('reads the whole survey when a field names no columns', () => {
    const fields = [field('Speaker', ['B']), field('Overall', [])];

    expect(deriveInputColumns(fields, AVAILABLE)).toEqual(AVAILABLE);
  });

  it('reads the whole survey when there are no fields yet', () => {
    expect(deriveInputColumns([], AVAILABLE)).toEqual(AVAILABLE);
  });

  it('never names a column the survey does not have', () => {
    const fields = [field('Speaker', ['B', 'Z'])];

    expect(deriveInputColumns(fields, AVAILABLE)).toEqual(['B']);
  });

  it('returns nothing when no survey is loaded yet', () => {
    expect(deriveInputColumns([field('Speaker', ['B'])], [])).toEqual([]);
  });
});
