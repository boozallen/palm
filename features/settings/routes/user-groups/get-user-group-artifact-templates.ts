import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import getUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/getUserGroupArtifactTemplates';

const inputSchema = z.object({
  id: z.string().uuid(),
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
  .query(async ({ input: { id }, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, id);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const templates = await getUserGroupArtifactTemplates(id);

    return { userGroupTemplates: templates };
  });
