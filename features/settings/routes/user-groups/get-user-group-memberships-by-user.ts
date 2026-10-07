import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembershipsByUser from '@/features/settings/dal/user-groups/getUserGroupMembershipsByUser';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

const outputSchema = z.object({
  memberships: z.array(
    z.object({
      userGroupId: z.string().uuid(),
      role: z.nativeEnum(UserGroupRole),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const memberships = await getUserGroupMembershipsByUser(input.userId);

    const output: z.infer<typeof outputSchema> = {
      memberships: memberships.map((membership) => ({
        userGroupId: membership.userGroupId,
        role: membership.role,
      })),
    };

    return output;
  });
