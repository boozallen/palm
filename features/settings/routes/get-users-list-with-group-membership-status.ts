import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import getUserGroupMemberships from '@/features/settings/dal/getUserGroupMemberships';
import getUsers from '@/features/settings/dal/getUsers';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  searchQuery: z.string(),
});

const outputSchema = z.object({
  usersGroupMembershipStatus: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email().nullable(),
      description: z.string().optional(),
      isMember: z.boolean(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(
        ctx.userId,
        input.userGroupId
      );
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const users = await getUsers(input.searchQuery, input.userId);
    const userGroupMemberships = await getUserGroupMemberships(
      input.userGroupId
    );
    const userGroupMemberIds = userGroupMemberships.map(
      (membership) => membership.userId
    );

    const output = {
      usersGroupMembershipStatus: users.map((user) => {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isMember: userGroupMemberIds.includes(user.id),
        };
      }),
    };

    return output;
  });
