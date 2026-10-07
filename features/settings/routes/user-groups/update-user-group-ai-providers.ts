import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupAiProviders from '@/features/settings/dal/user-groups/updateUserGroupAiProviders';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  aiProviderId: z.string().uuid(),
  enabled: z.boolean(),
});

const outputSchema = z.object({
  userGroupAiProviders: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, aiProviderId, enabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);
    const [userGroup, aiProvider] = await Promise.all([
      db.userGroup.findUnique({ where: { id: userGroupId }, select: { label: true } }),
      db.aiProvider.findUnique({ where: { id: aiProviderId }, select: { label: true } }),
    ]);

    try {
      const result = await updateUserGroupAiProviders({
        userGroupId,
        aiProviderId,
        enabled,
      });
      const output: z.infer<typeof outputSchema> = {
        userGroupAiProviders: result.map((aiProvider) => ({
          id: aiProvider.id,
          label: aiProvider.label,
          createdAt: aiProvider.createdAt,
          updatedAt: aiProvider.updatedAt,
        })),
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} ${enabled ? 'enabled' : 'disabled'} AI provider "${aiProvider?.label}" for user group "${userGroup?.label}"`,
        event: AuditRecordEvent.ModifyUserGroupAiProviderAccess,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to ${enabled ? 'enable' : 'disable'} AI provider "${aiProvider?.label}" for user group "${userGroup?.label}": ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupAiProviderAccess,
      });
      throw error;
    }
  });
