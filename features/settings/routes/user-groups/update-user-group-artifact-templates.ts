import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/updateUserGroupArtifactTemplates';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  templateId: z.string().uuid(),
  enabled: z.boolean(),
});

const outputSchema = z.object({
  userGroupTemplates: z.array(z.object({
    id: z.string().uuid(),
    filename: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, templateId, enabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const currentUser = await getUser(ctx.userId);
    const [userGroup, artifactTemplate] = await Promise.all([
      db.userGroup.findUnique({ where: { id: userGroupId }, select: { label: true } }),
      db.artifactTemplate.findUnique({ where: { id: templateId }, select: { filename: true } }),
    ]);

    try {
      const templates = await updateUserGroupArtifactTemplates({ userGroupId, templateId, enabled });

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} ${enabled ? 'enabled' : 'disabled'} artifact template "${artifactTemplate?.filename}" for user group "${userGroup?.label}"`,
        event: AuditRecordEvent.ModifyUserGroupArtifactTemplateAccess,
      });

      return { userGroupTemplates: templates };
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${currentUser?.name} failed to ${enabled ? 'enable' : 'disable'} artifact template "${artifactTemplate?.filename}" for user group "${userGroup?.label}": ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupArtifactTemplateAccess,
      });
      throw error;
    }
  });
