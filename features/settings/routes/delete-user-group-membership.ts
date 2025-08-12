import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole, UserGroupMembership, userGroupMembershipSchema } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import deleteUserGroupMembership from '@/features/settings/dal/deleteUserGroupMembership';
import getUser from '@/features/settings/dal/getUser';
import getUserGroup from '@/features/settings/dal/getUserGroup';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  userId: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(userGroupMembershipSchema)
  .mutation(async ({ input, ctx }) => {
    const { userGroupId, userId } = input;

    const currentUser = await getUser(ctx.userId);
    const targetUser = await getUser(userId);
    const userGroup = await getUserGroup(userGroupId);

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        ctx.auditor.createAuditRecord({
          outcome: 'WARN',
          description: `User ${currentUser?.name} attempted to delete user group membership of user ${targetUser?.name} in user group ${userGroup.label} but lacked permissions`,
          event: 'DELETE_USER_GROUP_MEMBERSHIP',
        });
        throw Forbidden('You do not have permission to access this resource');
      } else if (userId === ctx.userId) {
        // block non-Admin user group leads from deleting their own membership
        ctx.auditor.createAuditRecord({
          outcome: 'WARN',
          description: `User ${currentUser?.name} attempted to delete their own membership from user group ${userGroup.label}`,
          event: 'DELETE_USER_GROUP_MEMBERSHIP',
        });
        throw BadRequest('Unable to process your request');
      }
    }

    try {
      const result = await deleteUserGroupMembership(userGroupId, userId);

      const output: UserGroupMembership = {
        userGroupId: result.userGroupId,
        userId: result.userId,
        name: result.name,
        role: result.role,
        email: result.email,
      };

      ctx.auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User ${currentUser?.name} deleted user group membership of user ${targetUser?.name} in user group ${userGroup.label}`,
        event: 'DELETE_USER_GROUP_MEMBERSHIP',
      });

      return output;

    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `User ${currentUser?.name} failed to delete user group membership of user ${targetUser?.name} in user group ${userGroup.label}: ${(error as Error).message}`,
        event: 'DELETE_USER_GROUP_MEMBERSHIP',
      });
      throw new Error('Error deleting user group membership');
    }

  });
