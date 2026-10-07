import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupGraphDatabase from '@/features/settings/dal/user-groups/updateUserGroupGraphDatabase';
import getUser from '@/features/settings/dal/shared/getUser';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  graphDatabaseEnabled: z.boolean(),
});

const outputSchema = z.object({
  userGroup: z.object({
    id: z.string().uuid(),
    label: z.string(),
    graphDatabaseEnabled: z.boolean(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, graphDatabaseEnabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);

    try {
      const result = await updateUserGroupGraphDatabase({
        userGroupId,
        graphDatabaseEnabled,
      });

      const output: z.infer<typeof outputSchema> = {
        userGroup: {
          id: result.id,
          label: result.label,
          graphDatabaseEnabled: result.graphDatabaseEnabled,
          updatedAt: result.updatedAt,
        },
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} ${graphDatabaseEnabled ? 'enabled' : 'disabled'} graph database access for user group "${result.label}"`,
        event: AuditRecordEvent.ModifyUserGroupGraphDatabaseAccess,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to ${graphDatabaseEnabled ? 'enable' : 'disable'} graph database access for user group ${userGroupId}: ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupGraphDatabaseAccess,
      });
      throw error;
    }
  });