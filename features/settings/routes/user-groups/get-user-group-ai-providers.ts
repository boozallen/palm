import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { z } from 'zod';
import getUserGroupAiProviders from '@/features/settings/dal/user-groups/getUserGroupAiProviders';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import { UserGroupRole } from '@/features/shared/types/user-group';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  userGroupProviders: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      typeId: z.number().optional(),
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

    const result = await getUserGroupAiProviders(id);

    const output: z.infer<typeof outputSchema> = {
      userGroupProviders: result.map((aiProvider) => ({
        id: aiProvider.id,
        label: aiProvider.label,
        typeId: aiProvider.typeId,
        createdAt: aiProvider.createdAt,
        updatedAt: aiProvider.updatedAt,
      })),
    };

    return output;
  });
