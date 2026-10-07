import { z } from 'zod';
import crypto from 'crypto';
import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import getWorkflowForExecution from '@/features/workflows/dal/getWorkflowForExecution';
import createWorkflowExecution from '@/features/workflows/dal/createWorkflowExecution';
import { getWorkflowQueue } from '@/features/workflows/utils/worker/queue';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

const primitiveConfigSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(PrimitiveType),
  name: z.string(),
  config: z.record(z.unknown()),
  condition: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']),
    value: z.unknown(),
  }).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  predecessorIds: z.array(z.string()).optional(),
});

export const executeWorkflow = procedure
  .input(
    z.object({
      workflowId: z.string().uuid(),
      input: z.record(z.unknown()).optional(),
      primitives: z.array(primitiveConfigSchema).optional(),
      enableContinueGates: z.boolean().optional(),
      userGroupId: z.string().uuid().nullish(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to execute a workflow without workflows access`,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
      });
      throw Forbidden('You do not have access to workflows');
    }

    const workflow = await getWorkflowForExecution(input.workflowId, ctx.userId);

    if (!workflow || workflow.deletedAt) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to execute non-existent workflow ${input.workflowId}`,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
      });
      throw NotFound('Workflow not found');
    }

    const isCreator = workflow.createdBy === ctx.userId;
    const hasGroupAccess = workflow.userGroups.some(
      (group: { userGroupMemberships: unknown[] }) => group.userGroupMemberships.length > 0
    );

    if (!isCreator && !hasGroupAccess) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to execute workflow ${input.workflowId} without permission`,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
      });
      throw Forbidden('You do not have permission to execute this workflow');
    }

    // A pinned workflow's group is authoritative - never trust a client-supplied
    // group id over it. Only unpinned (legacy) workflows fall back to the client's choice.
    let userGroupId: string | null = workflow.pinnedUserGroupId ?? null;
    if (!userGroupId && input.userGroupId) {
      const isMember = await isUserGroupMember(ctx.userId, input.userGroupId);
      if (!isMember) {
        throw Forbidden('You are not a member of the selected group');
      }
      userGroupId = input.userGroupId;
    }

    const executionId = crypto.randomUUID();
    const definition = workflow.definition as unknown as { primitives?: PrimitiveConfig[] };
    const sanitizedInput = sanitizeForPostgres(input.input || {});

    // Use client-provided primitives if present, otherwise fall back to saved workflow definition
    const primitivesToExecute: PrimitiveConfig[] = (input.primitives ?? definition.primitives ?? []) as PrimitiveConfig[];

    const execution = await createWorkflowExecution(
      executionId,
      workflow.id,
      ctx.userId,
      sanitizedInput,
      userGroupId
    );

    const queue = getWorkflowQueue();
    if (!queue) {
      logger.warn('Workflow queue is not initialized — job not queued.');
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} submitted workflow ${workflow.id} for execution but the workflow queue is unavailable`,
        event: AuditRecordEvent.WorkflowExecutionFormSubmission,
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowExecution,
          resourceIds: [execution.id],
          workflowId: workflow.id,
          workflowExecutionId: execution.id,
        },
      });
      throw new Error('Workflow system is not available at this time.');
    }

    await queue.add('workflowExecution', {
      executionId: execution.id,
      workflowId: workflow.id,
      userId: ctx.userId,
      input: sanitizedInput,
      primitives: primitivesToExecute,
      enableContinueGates: input.enableContinueGates,
      userGroupId,
    });

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      description: `User ${ctx.userId} submitted workflow ${workflow.id} for execution`,
      event: AuditRecordEvent.WorkflowExecutionFormSubmission,
      metadata: {
        resourceType: AuditRecordResourceType.WorkflowExecution,
        resourceIds: [execution.id],
        workflowId: workflow.id,
        workflowExecutionId: execution.id,
      },
    });

    return {
      executionId: execution.id,
      status: execution.status,
      message: 'Workflow execution started',
    };
  });
