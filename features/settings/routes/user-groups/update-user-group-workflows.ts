import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupWorkflows from '@/features/settings/dal/user-groups/updateUserGroupWorkflows';
import getUser from '@/features/settings/dal/shared/getUser';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  workflowsEnabled: z.boolean(),
});

const outputSchema = z.object({
  userGroup: z.object({
    id: z.string().uuid(),
    label: z.string(),
    workflowsEnabled: z.boolean(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, workflowsEnabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);

    try {
      const result = await updateUserGroupWorkflows({
        userGroupId,
        workflowsEnabled,
      });

      const output: z.infer<typeof outputSchema> = {
        userGroup: {
          id: result.id,
          label: result.label,
          workflowsEnabled: result.workflowsEnabled,
          updatedAt: result.updatedAt,
        },
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} ${workflowsEnabled ? 'enabled' : 'disabled'} workflows access for user group "${result.label}"`,
        event: AuditRecordEvent.ModifyUserGroupWorkflowsAccess,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to ${workflowsEnabled ? 'enable' : 'disable'} workflows access for user group ${userGroupId}: ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupWorkflowsAccess,
      });
      throw error;
    }
  });