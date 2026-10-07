import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupGitHubProviders from '@/features/settings/dal/user-groups/updateUserGroupGitHubProviders';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  githubProviderId: z.string().uuid(),
  enabled: z.boolean(),
});

const outputSchema = z.object({
  userGroupGitHubProviders: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      description: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, githubProviderId, enabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);
    const [userGroup, githubProvider] = await Promise.all([
      db.userGroup.findUnique({ where: { id: userGroupId }, select: { label: true } }),
      db.gitHubProvider.findUnique({ where: { id: githubProviderId }, select: { label: true } }),
    ]);

    try {
      const result = await updateUserGroupGitHubProviders({ userGroupId, githubProviderId, enabled });

      const output = {
        userGroupGitHubProviders: result.map((p) => ({
          id: p.id,
          label: p.label,
          description: p.description,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} ${enabled ? 'enabled' : 'disabled'} GitHub provider "${githubProvider?.label}" for user group "${userGroup?.label}"`,
        event: AuditRecordEvent.ModifyUserGroupGithubProviderAccess,
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to ${enabled ? 'enable' : 'disable'} GitHub provider "${githubProvider?.label}" for user group "${userGroup?.label}": ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupGithubProviderAccess,
      });
      throw error;
    }
  });
