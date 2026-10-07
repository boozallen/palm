import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import getPulseResultsDal from '@/features/ai-agents/dal/pulse/getPulseResults';
import getPulseJob, { type PulseJobRecord } from '@/features/ai-agents/dal/pulse/getPulseJob';
import getPulseValueDistributions from '@/features/ai-agents/dal/pulse/getPulseValueDistributions';
import { parsePulseErrorMessage } from '@/features/ai-agents/utils/pulse/pulseErrors';
import {
  FAILED_RUN_OUTPUT_REASON,
  LEGACY_OUTPUT_REASON,
  PROCESSING_OUTPUT_REASON,
} from '@/features/ai-agents/utils/pulse/outputReasons';
import {
  PulseFieldType,
  type PulseDistribution,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';
import { PULSE_RUN_STATUSES } from '@/features/ai-agents/types/pulse/results';
import type {
  PulseOutputKind,
  PulseRunStatus,
  PulseRunView,
} from '@/features/ai-agents/types/pulse/results';

const input = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid(),
});

const outputReason = z.string().nullable();

const runViewSchema = z.object({
  id: z.string(),
  status: z.enum(PULSE_RUN_STATUSES),
  surveyFilename: z.string(),
  modelName: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  rowsInFile: z.number().nullable(),
  rowsAnalyzed: z.number().nullable(),
  failedRowCount: z.number().nullable(),
  message: z.object({ cause: z.string(), fix: z.string().nullable() }).nullable(),
  fallbacksByColumn: z.array(z.object({ fieldName: z.string(), count: z.number() })),
  recommendedActions: z.array(z.object({ action: z.string(), rationale: z.string() })).nullable(),
  outputs: z.object({ dashboard: outputReason, pdf: outputReason, slides: outputReason }),
  hasLegacyOutputs: z.boolean(),
});

const output = z.object({
  run: runViewSchema,
  fields: z.array(z.object({
    fieldName: z.string(),
    fieldType: z.nativeEnum(PulseFieldType),
    sortOrder: z.number(),
  })),
  results: z.array(z.object({
    id: z.string(),
    rowNumber: z.number(),
    responseText: z.string(),
    cells: z.array(z.object({ header: z.string(), value: z.string() })).nullable(),
    sortOrder: z.number(),
    values: z.array(z.object({
      fieldName: z.string(),
      value: z.string(),
      wasDefaulted: z.boolean(),
    })),
  })),
});

function toRunStatus(job: PulseJobRecord): PulseRunStatus {
  if (job.status === 'completed') {
    return job.errorMessage ? 'succeededWithWarnings' : 'succeeded';
  }

  if (job.status === 'error') {
    return 'failed';
  }

  return 'processing';
}

// A finished run without a profile was completed before outputs existed.
function isLegacyRun(job: PulseJobRecord): boolean {
  return job.status === 'completed' && job.resultsProfile === null;
}

function toOutputReason(job: PulseJobRecord, status: PulseRunStatus, kind: PulseOutputKind): string | null {
  if (status === 'failed') {
    return FAILED_RUN_OUTPUT_REASON;
  }

  if (status === 'processing') {
    return PROCESSING_OUTPUT_REASON;
  }

  if (isLegacyRun(job)) {
    return LEGACY_OUTPUT_REASON;
  }

  return job.outputErrors?.[kind] ?? null;
}

// Per output column, in matrix order, the rows that fell back; columns with none are left out.
function toFallbacksByColumn(
  fieldNames: string[],
  distributions: PulseDistribution[],
): PulseRunView['fallbacksByColumn'] {
  return fieldNames
    .map((fieldName) => ({
      fieldName,
      count: (distributions.find((distribution) => distribution.fieldName === fieldName)?.counts ?? [])
        .reduce((sum, entry) => sum + entry.defaultedCount, 0),
    }))
    .filter((entry) => entry.count > 0);
}

function toRunView(job: PulseJobRecord, distributions: PulseDistribution[]): PulseRunView {
  const status = toRunStatus(job);
  const hasMessage = status === 'failed' || status === 'succeededWithWarnings';

  return {
    id: job.id,
    status,
    surveyFilename: job.surveyFilename,
    modelName: job.modelName,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    rowsInFile: job.failedRowCount === null ? null : job.responseCount,
    rowsAnalyzed: job.failedRowCount === null ? null : job.responseCount - job.failedRowCount,
    failedRowCount: job.failedRowCount,
    message: hasMessage && job.errorMessage ? parsePulseErrorMessage(job.errorMessage) : null,
    fallbacksByColumn: toFallbacksByColumn(
      job.config.fields.map((field) => field.fieldName),
      distributions,
    ),
    recommendedActions: job.resultsNarrative?.recommendedActions ?? null,
    outputs: {
      dashboard: toOutputReason(job, status, 'dashboard'),
      pdf: toOutputReason(job, status, 'pdf'),
      slides: toOutputReason(job, status, 'slides'),
    },
    hasLegacyOutputs: isLegacyRun(job),
  };
}

/**
 * One run's process view plus its rows. The rows feed the client-built spreadsheet;
 * the output bodies are fetched separately, only when downloaded.
 */
export default procedure
  .input(input)
  .output(output)
  .query(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    const job = await getPulseJob(input.jobId, ctx.userId, input.agentId);

    if (!job) {
      throw NotFound('PULSE job not found');
    }

    const [{ results, fields }, distributions] = await Promise.all([
      getPulseResultsDal(input.jobId, ctx.userId, input.agentId),
      getPulseValueDistributions(input.jobId, job.config.fields.map((field) => field.fieldName)),
    ]);

    return {
      run: toRunView(job, distributions),
      fields,
      results,
    };
  });
