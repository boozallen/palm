import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import getUserGroupMemberships from '@/features/settings/dal/user-groups/getUserGroupMemberships';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  userGroupMemberships: z.array(
    z.object({
      userGroupId: z.string().uuid(),
      userId: z.string().uuid(),
      name: z.string(),
      role: z.nativeEnum(UserGroupRole),
      email: z.string().email().nullable(),
      lastLoginAt: z.date().nullable(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    const { id } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, id);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const members = await getUserGroupMemberships(id);

    const result = {
      userGroupMemberships: members.map((member) => ({
        userGroupId: member.userGroupId,
        userId: member.userId,
        name: member.name,
        role: member.role as UserGroupRole,
        email: member.email,
        lastLoginAt: member.lastLoginAt,
      })),
    };

    return result;
  });
