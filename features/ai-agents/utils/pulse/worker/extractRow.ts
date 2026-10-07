import logger from '@/server/logger';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import classifyModelError from '@/features/ai-agents/utils/pulse/classifyModelError';
import type { ClassifiedModelError } from '@/features/ai-agents/utils/pulse/classifyModelError';
import { formatPulseError } from '@/features/ai-agents/utils/pulse/pulseErrors';
import { parseJsonObject } from '@/features/ai-agents/utils/shared/parseJsonObject';
import {
  assembleFieldPrompt,
  assembleRowPrompt,
  getPulseSystemPrompt,
  groupFieldsByScope,
  hasScopedContent,
  scopeColumnsFor,
  validateFieldValue,
} from '@/features/ai-agents/utils/pulse/worker/assemblePrompt';
import type {
  ParsedSurveyRow,
  PulseExtractedValue,
  PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

export type PulseCompletionAdapter = Pick<AiFactoryCompletionAdapter, 'chat'>;

type ExtractRowParams = {
  row: ParsedSurveyRow;
  fields: PulseFieldConfig[];
  persona: string;
  // Named in the failure reason a user reads when the model refuses or errors.
  modelName: string;
  completionAdapter: PulseCompletionAdapter;
};

async function retryField(
  field: PulseFieldConfig,
  params: ExtractRowParams,
): Promise<{ ok: true; value: string } | { ok: false; reason: string }> {
  const response = await params.completionAdapter.chat({
    messages: [
      { role: 'system', content: getPulseSystemPrompt(params.persona) },
      { role: 'user', content: assembleFieldPrompt(params.row, field) },
    ],
  });

  const text = response.message.content;
  const parsed = parseJsonObject(text);

  // A single-field retry often comes back as a bare value rather than an object.
  const raw = parsed ? parsed[field.fieldName] : text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();

  return validateFieldValue(field, raw);
}

/**
 * Derives every configured field for one survey row.
 *
 * Fields are derived in groups that share the same source columns, so a field is only ever
 * shown the columns it was pointed at. A group whose columns are blank on this row is
 * recorded empty without calling the model at all. Anything left failing validation gets an
 * isolated retry, then the field's default with `wasDefaulted` set, so a value always exists
 * and nothing uncertain reads like a confident answer. A model error behind a default is
 * kept as the field's cause-and-fix `failureReason`.
 */
export default async function extractRowValues(
  params: ExtractRowParams,
): Promise<PulseExtractedValue[]> {
  const { row, fields, persona, modelName, completionAdapter } = params;

  const rowValues: Record<string, unknown> = {};
  const unanswerable = new Set<string>();

  // Keyed by field: one group's failed call must not suppress the retry a field in a
  // group that answered fine is owed, nor stamp its reason onto that field.
  const modelFailures = new Map<string, ClassifiedModelError>();

  for (const group of groupFieldsByScope(fields)) {
    if (!hasScopedContent(row, scopeColumnsFor(group))) {
      group.forEach((field) => unanswerable.add(field.fieldName));
      continue;
    }

    try {
      const response = await completionAdapter.chat({
        messages: [
          { role: 'system', content: getPulseSystemPrompt(persona) },
          { role: 'user', content: assembleRowPrompt(row, group) },
        ],
      });
      Object.assign(rowValues, parseJsonObject(response.message.content) ?? {});
    } catch (error) {
      const classified = classifyModelError(error, {
        modelName,
        fieldNames: group.map((field) => field.fieldName),
      });

      logger.warn('PULSE row extraction call failed', {
        rowNumber: row.rowNumber,
        category: classified.category,
        error: (error as Error).message,
      });

      group.forEach((field) => modelFailures.set(field.fieldName, classified));
    }
  }

  const extracted: PulseExtractedValue[] = [];

  for (const field of fields) {
    // Nothing was asked of the model here, so this is an unanswered question rather than a
    // failure, and it must not be counted as one.
    if (unanswerable.has(field.fieldName)) {
      extracted.push({
        fieldName: field.fieldName,
        value: '',
        wasDefaulted: false,
        failureReason: null,
      });
      continue;
    }

    const modelFailure = modelFailures.get(field.fieldName) ?? null;
    const first = validateFieldValue(field, rowValues[field.fieldName]);

    if (first.ok) {
      extracted.push({
        fieldName: field.fieldName,
        value: first.value,
        wasDefaulted: false,
        failureReason: null,
      });
      continue;
    }

    let retry: { ok: true; value: string } | { ok: false; reason: string } = first;
    let retryFailure: ClassifiedModelError | null = null;

    // A busy endpoint (timeout, rate limit, dropped connection) would just be re-hit by a
    // per-field retry; any other failure may be specific to the group call, so retry it.
    if (!modelFailure?.retryable) {
      try {
        retry = await retryField(field, params);
      } catch (error) {
        retryFailure = classifyModelError(error, { modelName, fieldNames: [field.fieldName] });

        logger.warn('PULSE field retry call failed', {
          rowNumber: row.rowNumber,
          fieldName: field.fieldName,
          category: retryFailure.category,
          error: (error as Error).message,
        });
      }
    }

    if (retry.ok) {
      extracted.push({
        fieldName: field.fieldName,
        value: retry.value,
        wasDefaulted: false,
        failureReason: null,
      });
      continue;
    }

    const failure = modelFailure ?? retryFailure;
    const reason = failure ? formatPulseError(failure.error) : retry.reason;

    logger.warn('PULSE field fell back to its default value', {
      rowNumber: row.rowNumber,
      fieldName: field.fieldName,
      reason,
    });

    extracted.push({
      fieldName: field.fieldName,
      value: field.defaultValue ?? '',
      wasDefaulted: true,
      failureReason: reason,
    });
  }

  return extracted;
}
