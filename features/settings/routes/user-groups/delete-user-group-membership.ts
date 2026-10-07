import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole, UserGroupMembership, userGroupMembershipSchema } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import deleteUserGroupMembership from '@/features/settings/dal/user-groups/deleteUserGroupMembership';
import { syncAdminDocumentUsersOnGroupLeave } from '@/features/shared/dal/document-library/upload/syncAdminDocumentUsers';
import getUser from '@/features/settings/dal/shared/getUser';
import getUserGroup from '@/features/settings/dal/user-groups/getUserGroup';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

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
          outcome: AuditRecordOutcome.Warn,
          description: `User ${currentUser?.name} attempted to delete user group membership of user ${targetUser?.name} in user group ${userGroup.label} but lacked permissions`,
          event: AuditRecordEvent.DeleteUserGroupMembership,
        });
        throw Forbidden('You do not have permission to access this resource');
      } else if (userId === ctx.userId) {
        // block non-Admin user group leads from deleting their own membership
        ctx.auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Warn,
          description: `User ${currentUser?.name} attempted to delete their own membership from user group ${userGroup.label}`,
          event: AuditRecordEvent.DeleteUserGroupMembership,
        });
        throw BadRequest('Unable to process your request');
      }
    }

    try {
      const result = await deleteUserGroupMembership(userGroupId, userId);

      await syncAdminDocumentUsersOnGroupLeave(userId, userGroupId);

      const output: UserGroupMembership = {
        userGroupId: result.userGroupId,
        userId: result.userId,
        name: result.name,
        role: result.role,
        email: result.email,
        lastLoginAt: result.lastLoginAt,
      };

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${currentUser?.name} deleted user group membership of user ${targetUser?.name} in user group ${userGroup.label}`,
        event: AuditRecordEvent.DeleteUserGroupMembership,
      });

      return output;

    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${currentUser?.name} failed to delete user group membership of user ${targetUser?.name} in user group ${userGroup.label}: ${(error as Error).message}`,
        event: AuditRecordEvent.DeleteUserGroupMembership,
      });
      throw new Error('Error deleting user group membership');
    }

  });
