import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import updateUserGroupMemberRole from '@/features/settings/dal/updateUserGroupMemberRole';
import getUser from '@/features/settings/dal/getUser';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(UserGroupRole),
});
const outputSchema = z.object({
  userGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(UserGroupRole),
});
export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const { userGroupId, userId } = input;
    const currentUser = await getUser(ctx.userId);
    const targetedUser = await getUser(input.userId);
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        ctx.auditor.createAuditRecord({
          outcome: 'WARN',
          description: `${currentUser?.name} attempted to update user group membership role of ${targetedUser?.name} from ${membership?.role} to ${input.role} but lacked permissions`,
          event: 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
        });
        throw Forbidden('You do not have permission to access this resource');
      }
    }
    try {
      const result = await updateUserGroupMemberRole(input);
      const output = {
        role: result.role as UserGroupRole,
        userGroupId: userGroupId,
        userId: userId,
      };
      ctx.auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `${currentUser?.name} updated user group membership role of ${targetedUser?.name} to ${output.role}`,
        event: 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
      });
      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `${
          currentUser?.name
        } failed to update user group membership role of ${
          targetedUser?.name
        } to ${input.role}: ${(error as Error).message}`,
        event: 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
      });
      throw new Error('Error updating user group member role');
    }
  });
