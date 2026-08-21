import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { NotFound, Forbidden, BadRequest } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import createSharedWorkflow from '@/features/workflows/dal/createSharedWorkflow';
import softDeleteSharedWorkflow from '@/features/workflows/dal/softDeleteSharedWorkflow';
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

export const updateWorkflowShares = procedure
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
        description: `User ${ctx.userId} attempted to update shares for non-existent workflow ${input.workflowId}`,
        event: AuditRecordEvent.UpdateWorkflowShares,
      });
      throw NotFound('Workflow not found');
    }

    if (workflow.createdBy !== ctx.userId) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to update shares for workflow ${input.workflowId} owned by ${workflow.createdBy}`,
        event: AuditRecordEvent.UpdateWorkflowShares,
      });
      throw Forbidden('You do not have permission to update shares for this workflow');
    }

    const userGroups = await getUserGroups(ctx.userId);

    if (userGroups.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to update shares for workflow ${input.workflowId} but is not a member of any user groups`,
        event: AuditRecordEvent.UpdateWorkflowShares,
      });
      throw BadRequest('You must be a member of at least one user group to update workflow shares');
    }

    if (input.userGroupIds === undefined) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to update shares for workflow ${input.workflowId} without specifying user groups`,
        event: AuditRecordEvent.UpdateWorkflowShares,
      });
      throw BadRequest('You must explicitly specify which user groups to share with (or provide an empty array to unshare)');
    }

    let sharedWithUserGroupIds = input.userGroupIds;

    if (sharedWithUserGroupIds.length > 0) {
      // Validate that user is a member of all selected groups
      const userGroupIds = userGroups.map((g) => g.id);
      const invalidGroupIds = sharedWithUserGroupIds.filter((id) => !userGroupIds.includes(id));

      if (invalidGroupIds.length > 0) {
        ctx.auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Warn,
          description: `User ${ctx.userId} attempted to update shares for workflow ${input.workflowId} with groups they are not a member of: ${invalidGroupIds.join(', ')}`,
          event: AuditRecordEvent.UpdateWorkflowShares,
        });
        throw BadRequest('You can only share with user groups you are a member of');
      }
    }

    try {
      // Fetch existing SharedWorkflow with accepted actions before soft-deleting
      const existingSharedWorkflow = await db.sharedWorkflow.findFirst({
        where: {
          sourceWorkflowId: input.workflowId,
          sourceUserId: ctx.userId,
          deletedAt: null,
        },
        include: {
          actions: {
            where: {
              status: 'accepted',
            },
          },
        },
      });

      await softDeleteSharedWorkflow({
        sourceWorkflowId: input.workflowId,
        sourceUserId: ctx.userId,
      });

      const sharedWorkflow = await createSharedWorkflow({
        sourceWorkflowId: input.workflowId,
        sourceUserId: ctx.userId,
        sharedWithUserGroupIds,
      });

      // Preserve accepted actions so users who already accepted don't see it again
      if (existingSharedWorkflow && existingSharedWorkflow.actions.length > 0) {
        await db.sharedWorkflowAction.createMany({
          data: existingSharedWorkflow.actions.map((action) => ({
            sharedWorkflowId: sharedWorkflow.id,
            userId: action.userId,
            status: action.status,
            copiedWorkflowId: action.copiedWorkflowId,
          })),
          skipDuplicates: true,
        });
      }

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} updated shares for workflow ${input.workflowId} with user groups: ${sharedWithUserGroupIds.join(', ')}`,
        event: AuditRecordEvent.UpdateWorkflowShares,
      });

      return {
        sharedWorkflow,
      };
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to update shares for workflow ${input.workflowId}: ${(error as Error).message}`,
        event: AuditRecordEvent.UpdateWorkflowShares,
      });
      throw error;
    }
  });
