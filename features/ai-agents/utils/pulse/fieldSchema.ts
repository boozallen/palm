import { z } from 'zod';

import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

// The longest results focus a run accepts; the start route and the setup form share it.
export const MAX_RESULTS_FOCUS_LENGTH = 1000;

/**
 * The single boundary a configured output column crosses into the server, so the
 * real run and the single-row test cannot disagree about what is valid.
 * `fieldName` is trimmed here because it is both the key the model is asked for
 * and the key its answer is read back from: a trailing space defaults the column.
 */
export const pulseFieldSchema = z.object({
  fieldName: z.string().trim().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  fieldType: z.nativeEnum(PulseFieldType),
  allowedValues: z.array(z.string().min(1)).max(50),
  defaultValue: z.string().nullable(),
  inputColumnRefs: z.array(z.string().regex(/^[A-Z]{1,3}$/)),
  sortOrder: z.number().int().min(0),
});

// Two columns under one name collide as JSON keys, so one of them is unreachable.
export function addDuplicateFieldNameIssue(
  fields: Array<{ fieldName: string }>,
  ctx: z.RefinementCtx,
): void {
  const names = fields.map((field) => field.fieldName.trim().toLowerCase());

  if (new Set(names).size !== names.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fields'],
      message: 'Each output column needs a distinct name.',
    });
  }
}
