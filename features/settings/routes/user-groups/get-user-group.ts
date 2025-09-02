import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { userGroupSchema, UserGroup, UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import getUserGroup from '@/features/settings/dal/user-groups/getUserGroup';

const inputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(userGroupSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, input.id);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const result = await getUserGroup(input.id);

    const output: UserGroup = {
      id: result.id,
      label: result.label,
      joinCode: result.joinCode,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      memberCount: result.memberCount,
    };

    return output;
  });
