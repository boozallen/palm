import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { procedure } from '@/server/trpc';
import logger from '@/server/logger';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import resolveUserGroupId from '@/features/shared/services/resolveUserGroupId';
import { AIFactory } from '@/features/ai-provider/factory';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import {
  addDuplicateFieldNameIssue,
  pulseFieldSchema,
} from '@/features/ai-agents/utils/pulse/fieldSchema';
import { buildResponseText } from '@/features/ai-agents/utils/pulse/readSurveyRows';
import {
  formatPulseError,
  testInputInvalidError,
  testTimedOutError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import extractRowValues from '@/features/ai-agents/utils/pulse/worker/extractRow';
import type { PulseExtractedValue } from '@/features/ai-agents/types/pulse/surveyAnalysis';

export const TEST_ROW_TIME_BUDGET_MS = 90_000;

const cellSchema = z.object({
  column: z.string().regex(/^[A-Z]{1,3}$/),
  header: z.string(),
  value: z.string(),
});

// The field matrix is held to the same schema and the same distinct-name rule the
// real run applies, so the panel cannot accept a matrix the run would reject.
const inputSchema = z.object({
  agentId: z.string().uuid(),
  modelId: z.string().min(1),
  persona: z.string().max(4000),
  rowNumber: z.number().int().min(1),
  cells: z.array(cellSchema).min(1),
  fields: z.array(pulseFieldSchema).min(1).max(25),
  userGroupId: z.string().uuid().nullish(),
}).superRefine((value, ctx) => {
  addDuplicateFieldNameIssue(value.fields, ctx);
});

type TestPulseRowInput = z.input<typeof inputSchema>;

const output = z.object({
  values: z.array(z.object({
    fieldName: z.string(),
    value: z.string(),
    wasDefaulted: z.boolean(),
    failureReason: z.string().nullable(),
  })),
});

const TOP_LEVEL_LABELS: Record<string, string> = {
  agentId: 'Agent',
  modelId: 'Model',
  persona: 'Persona',
  rowNumber: 'Row number',
  cells: 'Response cells',
  fields: 'Output columns',
  userGroupId: 'Group',
};

const CELL_LABELS: Record<string, string> = {
  column: 'column',
  header: 'header',
  value: 'answer',
};

const FIELD_LABELS: Record<string, string> = {
  fieldName: 'name',
  prompt: 'prompt',
  fieldType: 'type',
  allowedValues: 'allowed values',
  defaultValue: 'fallback',
  inputColumnRefs: 'source columns',
  sortOrder: 'order',
};

// 'fields.0.prompt' → 'Output column 1 prompt'.
function describePath(path: Array<string | number>): string {
  const [top, index, key] = path;
  const label = TOP_LEVEL_LABELS[String(top)] ?? 'Input';

  if (typeof index !== 'number') {
    return label;
  }

  const itemLabel = top === 'cells'
    ? `Response cell ${index + 1}`
    : top === 'fields'
      ? `Output column ${index + 1}`
      : `${label} ${index + 1}`;

  if (key === undefined) {
    return itemLabel;
  }

  const keyLabels = top === 'cells' ? CELL_LABELS : top === 'fields' ? FIELD_LABELS : {};

  return `${itemLabel} ${keyLabels[String(key)] ?? String(key)}`;
}

function describeIssue(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === 'undefined' ? 'missing' : `expected ${issue.expected}, got ${issue.received}`;
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return issue.minimum === 1 ? 'empty' : `needs at least ${issue.minimum} characters`;
      }
      if (issue.type === 'array') {
        return `needs at least ${issue.minimum}`;
      }
      if (issue.type === 'number') {
        return `must be ${issue.minimum} or more`;
      }
      return issue.message;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return `over the limit of ${issue.maximum} characters`;
      }
      if (issue.type === 'array') {
        return `over the limit of ${issue.maximum}`;
      }
      if (issue.type === 'number') {
        return `must be ${issue.maximum} or less`;
      }
      return issue.message;
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'regex') {
        return 'not a column letter (like B or AA)';
      }
      if (issue.validation === 'uuid') {
        return 'not a valid id';
      }
      return issue.message;
    case z.ZodIssueCode.invalid_enum_value:
      return `must be one of ${issue.options.join(', ')}`;
    default:
      return issue.message;
  }
}

// One plain line per problem, so the panel can show what to change instead of a schema dump.
function describeIssues(error: z.ZodError): string[] {
  const lines = error.issues.map((issue) => `${describePath(issue.path)}: ${describeIssue(issue)}`);

  return [...new Set(lines)];
}

// The model call can't be cancelled, so a late settle is ignored rather than left unhandled.
async function withinTimeBudget<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TRPCError({ code: 'TIMEOUT', message: formatPulseError(testTimedOutError()) }));
    }, TEST_ROW_TIME_BUDGET_MS);
  });

  work.catch(() => undefined);

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs the matrix the user is currently editing against one row. Creates no job
 * and writes nothing, so a prompt can be tuned in seconds instead of by running
 * the whole survey and inferring what went wrong.
 */
export default procedure
  .input(z.custom<TestPulseRowInput>())
  .output(output)
  .mutation(async ({ ctx, input: rawInput }) => {
    const parsed = inputSchema.safeParse(rawInput);

    if (!parsed.success) {
      throw BadRequest(formatPulseError(testInputInvalidError(describeIssues(parsed.error))));
    }

    const input = parsed.data;

    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find((a) => a.id === input.agentId && a.type === AiAgentType.PULSE);

    if (!agent) {
      throw Forbidden('PULSE agent not found or access denied');
    }

    const runTest = async (): Promise<PulseExtractedValue[]> => {
      const userGroupId = await resolveUserGroupId(ctx.userId, input.userGroupId);

      const ai = new AIFactory({ userId: ctx.userId, userGroupId: userGroupId ?? undefined });
      const completionSource = await ai.buildUserSource(input.modelId);
      const completionAdapter = new AiFactoryCompletionAdapter(completionSource);

      const cells = Object.fromEntries(input.cells.map((cell) => [cell.column, cell]));

      return extractRowValues({
        row: {
          rowNumber: input.rowNumber,
          cells,
          responseText: buildResponseText(input.cells),
        },
        fields: input.fields,
        persona: input.persona,
        modelName: completionSource.model.name,
        completionAdapter,
      });
    };

    const values = await withinTimeBudget(runTest());

    logger.info('PULSE single-row test completed', {
      agentId: input.agentId,
      fieldCount: input.fields.length,
    });

    return { values };
  });
