import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateUserGroupKbProviders from '@/features/settings/dal/user-groups/updateUserGroupKbProviders';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  kbProviderId: z.string().uuid(),
  enabled: z.boolean(),
});

const outputSchema = z.object({
  userGroupKbProviders: z.array(
    z.object({
      id: z.string().uuid(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, kbProviderId, enabled } = input;
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(
        ctx.userId,
        input.userGroupId
      );
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);
    const [userGroup, kbProvider] = await Promise.all([
      db.userGroup.findUnique({ where: { id: userGroupId }, select: { label: true } }),
      db.kbProvider.findUnique({ where: { id: kbProviderId }, select: { label: true } }),
    ]);

    try {
      const result = await updateUserGroupKbProviders({
        userGroupId,
        kbProviderId,
        enabled,
      });

      const output: z.infer<typeof outputSchema> = {
        userGroupKbProviders: result.map((kbProvider) => ({
          id: kbProvider.id,
        })),
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} ${enabled ? 'enabled' : 'disabled'} knowledge base provider "${kbProvider?.label}" for user group "${userGroup?.label}"`,
        event: AuditRecordEvent.ModifyUserGroupKbProviderAccess,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to ${enabled ? 'enable' : 'disable'} knowledge base provider "${kbProvider?.label}" for user group "${userGroup?.label}": ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupKbProviderAccess,
      });
      throw error;
    }
  });
