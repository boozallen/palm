import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupAiProviders from '@/features/settings/dal/user-groups/updateUserGroupAiProviders';

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

    return output;
  });
