import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupMemberRole from '@/features/settings/dal/user-groups/updateUserGroupMemberRole';
import getUser from '@/features/settings/dal/shared/getUser';

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
          outcome: AuditRecordOutcome.Warn,
          description: `${currentUser?.name} attempted to update user group membership role of ${targetedUser?.name} from ${membership?.role} to ${input.role} but lacked permissions`,
          event: AuditRecordEvent.ModifyUserGroupMembershipRole,
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
        outcome: AuditRecordOutcome.Success,
        description: `${currentUser?.name} updated user group membership role of ${targetedUser?.name} to ${output.role}`,
        event: AuditRecordEvent.ModifyUserGroupMembershipRole,
      });
      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `${
          currentUser?.name
        } failed to update user group membership role of ${
          targetedUser?.name
        } to ${input.role}: ${(error as Error).message}`,
        event: AuditRecordEvent.ModifyUserGroupMembershipRole,
      });
      throw new Error('Error updating user group member role');
    }
  });
