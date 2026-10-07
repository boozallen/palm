import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { Forbidden, InternalServerError } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getAvailableModels from '@/features/shared/dal/getAvailableModels';
import { AiAgentType } from '@/features/shared/types';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';
import createPulseJob from '@/features/ai-agents/dal/pulse/createPulseJob';
import {
  addDuplicateFieldNameIssue,
  MAX_RESULTS_FOCUS_LENGTH,
  pulseFieldSchema,
} from '@/features/ai-agents/utils/pulse/fieldSchema';
import { getPulseQueue } from '@/features/ai-agents/utils/pulse/worker/queue';
import { MATRIX_MAX_FIELDS } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import {
  fallbackIsAllowedValueError,
  formatPulseError,
  matrixTooManyColumnsError,
  queueUnavailableError,
  sourceColumnUnresolvedError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const input = z.object({
  agentId: z.string().uuid(),
  surveyFileKey: z.string().min(1),
  surveyFileName: z.string().min(1),
  documentUploadProviderId: z.string().uuid(),
  modelId: z.string().min(1),
  persona: z.string().max(4000),
  resultsFocus: z.string().max(MAX_RESULTS_FOCUS_LENGTH).nullable(),
  sheetName: z.string().min(1),
  headerRow: z.number().int().min(1),
  inputColumns: z.array(z.string().regex(/^[A-Z]{1,3}$/)).min(1),
  responseCount: z.number().int().min(1),
  fields: z.array(pulseFieldSchema).min(1),
  userGroupId: z.string().uuid().nullish(),
}).superRefine((value, ctx) => {
  addDuplicateFieldNameIssue(value.fields, ctx);

  // Checked here rather than with .max() so the message reads as a cause and a fix.
  if (value.fields.length > MATRIX_MAX_FIELDS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fields'],
      message: formatPulseError(matrixTooManyColumnsError(value.fields.length, MATRIX_MAX_FIELDS)),
    });
  }

  value.fields.forEach((field, index) => {
    if (field.fieldType !== PulseFieldType.FREE_TEXT && field.allowedValues.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fields', index, 'allowedValues'],
        message: `"${field.fieldName}" needs at least one allowed value.`,
      });
    }

    // The fallback must stay distinguishable from a real answer, or an extraction
    // failure and a genuine value become one bucket in the distribution counts.
    // Cased like validateFieldValue, which matches the model's answer case-insensitively.
    const fallback = field.defaultValue ?? null;

    if (fallback !== null && field.allowedValues.some((allowed) => allowed.toLowerCase() === fallback.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fields', index, 'defaultValue'],
        message: formatPulseError(fallbackIsAllowedValueError(field.fieldName, fallback)),
      });
    }

    field.inputColumnRefs.forEach((ref) => {
      if (!value.inputColumns.includes(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', index, 'inputColumnRefs'],
          message: formatPulseError(sourceColumnUnresolvedError(ref, value.inputColumns)),
        });
      }
    });
  });
});

const output = z.object({
  jobId: z.string(),
  message: z.string(),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    // Stored by name as well so the run keeps its label after the model is removed.
    const models = await getAvailableModels(ctx.userId);
    const modelName = models.find((model) => model.id === input.modelId)?.name ?? null;

    const queue = getPulseQueue();

    if (!queue) {
      throw InternalServerError(formatPulseError(queueUnavailableError()));
    }

    const userGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);
    const jobId = uuid();

    await createPulseJob({
      id: jobId,
      aiAgentId: input.agentId,
      userId: ctx.userId,
      userGroupId,
      surveyFilename: input.surveyFileName,
      responseCount: input.responseCount,
      persona: input.persona,
      resultsFocus: input.resultsFocus?.trim() || null,
      modelId: input.modelId,
      modelName,
      sheetName: input.sheetName,
      headerRow: input.headerRow,
      inputColumns: input.inputColumns,
      fields: input.fields,
    });

    await storage.hset(`pulse-job:${jobId}`, {
      status: 'queued',
      progress: `Job queued, waiting to start on ${input.responseCount.toLocaleString('en-US')} responses...`,
      created: Date.now(),
      last_updated: Date.now(),
    });

    await queue.add('pulseJob', {
      jobId,
      userId: ctx.userId,
      agentId: input.agentId,
      surveyFileKey: input.surveyFileKey,
      surveyFilename: input.surveyFileName,
      surveyContentType: XLSX_CONTENT_TYPE,
      documentUploadProviderId: input.documentUploadProviderId,
      modelId: input.modelId,
      userGroupId,
    });

    logger.info('PULSE job queued', { jobId, fieldCount: input.fields.length });

    return { jobId, message: 'PULSE analysis job queued successfully' };
  });
