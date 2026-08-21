import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/updateUserGroupArtifactTemplates';

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

    const templates = await updateUserGroupArtifactTemplates({ userGroupId, templateId, enabled });

    return { userGroupTemplates: templates };
  });
