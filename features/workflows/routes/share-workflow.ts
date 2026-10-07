import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { NotFound, Forbidden, BadRequest } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedWorkflow from '@/features/workflows/dal/createSharedWorkflow';
import { SharedWorkflowSchema } from '@/features/workflows/types/shared-workflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import db from '@/server/db';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  workflowId: z.string().uuid(),
  userGroupIds: z.array(z.string().uuid()).optional(),
});

const outputSchema = z.object({
  sharedWorkflow: SharedWorkflowSchema,
});

export const shareWorkflow = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const workflow = await db.workflow.findUnique({
      where: { id: input.workflowId, deletedAt: null },
    });

    if (!workflow) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share non-existent workflow ${input.workflowId}`,
        event: AuditRecordEvent.ShareWorkflow,
      });
      throw NotFound('Workflow not found');
    }

    if (workflow.createdBy !== ctx.userId) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share workflow ${input.workflowId} owned by ${workflow.createdBy}`,
        event: AuditRecordEvent.ShareWorkflow,
      });
      throw Forbidden('You do not have permission to share this workflow');
    }

    const userGroups = await getUserGroups(ctx.userId);

    if (userGroups.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share workflow ${input.workflowId} but is not a member of any user groups`,
        event: AuditRecordEvent.ShareWorkflow,
      });
      throw BadRequest('You must be a member of at least one user group to share a workflow');
    }

    if (!input.userGroupIds || input.userGroupIds.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share workflow ${input.workflowId} without selecting any user groups`,
        event: AuditRecordEvent.ShareWorkflow,
      });
      throw BadRequest('You must select at least one user group to share with');
    }

    // Validate that user is a member of all selected groups
    const userGroupIds = userGroups.map((g) => g.id);
    const invalidGroupIds = input.userGroupIds.filter((id) => !userGroupIds.includes(id));

    if (invalidGroupIds.length > 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to share workflow ${input.workflowId} with groups they are not a member of: ${invalidGroupIds.join(', ')}`,
        event: AuditRecordEvent.ShareWorkflow,
      });
      throw BadRequest('You can only share with user groups you are a member of');
    }

    const sharedWithUserGroupIds = input.userGroupIds;

    try {
      const sharedWorkflow = await createSharedWorkflow({
        sourceWorkflowId: input.workflowId,
        sourceUserId: ctx.userId,
        sharedWithUserGroupIds,
      });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} shared workflow ${input.workflowId} with user groups: ${sharedWithUserGroupIds.join(', ')}`,
        event: AuditRecordEvent.ShareWorkflow,
      });

      return {
        sharedWorkflow,
      };
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to share workflow ${input.workflowId}: ${(error as Error).message}`,
        event: AuditRecordEvent.ShareWorkflow,
      });
      throw error;
    }
  });
