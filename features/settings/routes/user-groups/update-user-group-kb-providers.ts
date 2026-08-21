import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateUserGroupKbProviders from '@/features/settings/dal/user-groups/updateUserGroupKbProviders';

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

    return output;
  });
