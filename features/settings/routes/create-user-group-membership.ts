import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import {
  UserGroupRole,
  UserGroupMembership,
  userGroupMembershipSchema,
} from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import createUserGroupMembership from '@/features/shared/dal/createUserGroupMembership';
import getUser from '@/features/settings/dal/getUser';
import getUserGroup from '@/features/settings/dal/getUserGroup';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(UserGroupRole),
});

export default procedure
  .input(inputSchema)
  .output(userGroupMembershipSchema)
  .mutation(async ({ input, ctx }) => {
    const { userGroupId, userId, role } = input;

    const currentUser = await getUser(ctx.userId);
    const targetedUser = await getUser(userId);
    const userGroup = await getUserGroup(userGroupId);

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        ctx.auditor.createAuditRecord({
          outcome: 'WARN',
          description: `User ${currentUser?.name} attempted to create a user group membership for user ${targetedUser?.name} with a role of ${role} in group ${userGroup.label} but lacked permissions`,
          event: 'CREATE_USER_GROUP_MEMBERSHIP',
        });

        throw Forbidden('You do not have permission to access this resource');
      }
    }

    try {
      const result = await createUserGroupMembership(userGroupId, userId, role);

      const output: UserGroupMembership = {
        userGroupId: result.userGroupId,
        userId: result.userId,
        name: result.name,
        role: result.role,
        email: result.email,
      };

      ctx.auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User ${currentUser?.name} created a user group membership for user ${targetedUser?.name} with a role of ${role} in group ${userGroup.label}`,
        event: 'CREATE_USER_GROUP_MEMBERSHIP',
      });

      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `User ${currentUser?.name
          } failed to create a user group membership for user ${targetedUser?.name
          } with a role of ${role} in group ${userGroup.label}: ${(error as Error).message
          }`,
        event: 'CREATE_USER_GROUP_MEMBERSHIP',
      });

      throw new Error('Error creating user group membership');
    }
  });
