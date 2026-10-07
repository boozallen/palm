import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupKbProviders from '@/features/settings/dal/user-groups/getUserGroupKbProviders';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
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
  .query(async ({ input: { userGroupId }, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const result = await getUserGroupKbProviders(userGroupId);

    const output: z.infer<typeof outputSchema> = {
      userGroupKbProviders: result.map((kbProvider) => ({
        id: kbProvider.id,
      })),
    };

    return output;
  });
