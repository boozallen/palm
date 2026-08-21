import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/profile/dal/getUserGroups';
import rejectSharedWorkflow from '@/features/workflows/dal/rejectSharedWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { SharedWorkflowActionSchema } from '@/features/workflows/types/shared-workflow';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  sharedWorkflowId: z.string().uuid(),
});

const outputSchema = z.object({
  action: SharedWorkflowActionSchema,
});

export const rejectSharedWorkflowRoute = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const userGroups = await getUserGroups(ctx.userId);

    if (userGroups.length === 0) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${ctx.userId} attempted to reject shared workflow ${input.sharedWorkflowId} but is not a member of any user groups`,
        event: AuditRecordEvent.RejectWorkflowShare,
      });
      throw BadRequest('You must be a member of at least one user group');
    }

    const userGroupIds = userGroups.map((g) => g.id);

    try {
      const result = await rejectSharedWorkflow({
        sharedWorkflowId: input.sharedWorkflowId,
        userId: ctx.userId,
        userGroupIds,
      });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${ctx.userId} rejected shared workflow ${input.sharedWorkflowId}`,
        event: AuditRecordEvent.RejectWorkflowShare,
      });

      return result;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${ctx.userId} failed to reject shared workflow ${input.sharedWorkflowId}: ${(error as Error).message}`,
        event: AuditRecordEvent.RejectWorkflowShare,
      });
      throw error;
    }
  });
