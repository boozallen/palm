import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import getUserGroupGitHubProviders from '@/features/settings/dal/user-groups/getUserGroupGitHubProviders';

const inputSchema = z.object({
  id: z.string().uuid(),
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
  .query(async ({ input: { id }, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, id);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const result = await getUserGroupGitHubProviders(id);

    return {
      userGroupGitHubProviders: result.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  });
