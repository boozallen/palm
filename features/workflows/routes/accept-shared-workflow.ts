import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import acceptSharedWorkflow from '@/features/workflows/dal/acceptSharedWorkflow';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { SharedWorkflowActionSchema } from '@/features/workflows/types/shared-workflow';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  sharedWorkflowId: z.string().uuid(),
});

const outputSchema = z.object({
  action: SharedWorkflowActionSchema,
  workflowName: z.string(),
});

export const acceptSharedWorkflowRoute = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const { userId } = ctx;
    const userGroups = await getUserGroups(userId);
    const userGroupIds = userGroups.map((g) => g.id);

    if (userGroupIds.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${userId} attempted to accept shared workflow ${input.sharedWorkflowId} but is not a member of any user groups`,
        event: AuditRecordEvent.AcceptWorkflowShare,
      });
      throw BadRequest('You must be a member of a user group to accept shared workflows');
    }

    try {
      const result = await acceptSharedWorkflow({
        sharedWorkflowId: input.sharedWorkflowId,
        userId,
        userGroupIds,
      });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${userId} accepted shared workflow ${input.sharedWorkflowId}, created copy ${result.action.copiedWorkflowId}`,
        event: AuditRecordEvent.AcceptWorkflowShare,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${userId} failed to accept shared workflow ${input.sharedWorkflowId}: ${(error as Error).message}`,
        event: AuditRecordEvent.AcceptWorkflowShare,
      });
      throw error;
    }
  });
