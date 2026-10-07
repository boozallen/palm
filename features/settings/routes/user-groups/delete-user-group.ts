import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import deleteUserGroup from '@/features/settings/dal/user-groups/deleteUserGroup';
import getUser from '@/features/settings/dal/shared/getUser';
import getUserGroup from '@/features/settings/dal/user-groups/getUserGroup';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const { id } = input;
    const currentUser = await getUser(ctx.userId);
    const userGroup = await getUserGroup(id);

    if (ctx.userRole !== UserRole.Admin) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Warn,
        description: `User ${currentUser?.name} attempted to delete user group ${userGroup?.label} but lacked permissions`,
        event: AuditRecordEvent.DeleteUserGroup,
      });
      throw Forbidden('You do not have permission to access this resource');
    }

    try {
      const result = await deleteUserGroup(id);

      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Success,
        description: `User ${currentUser?.name} deleted user group ${userGroup?.label}`,
        event: AuditRecordEvent.DeleteUserGroup,
      });

      return { id: result.id };

    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: AuditRecordOutcome.Error,
        description: `User ${currentUser?.name} failed to delete user group ${userGroup?.label}: ${(error as Error).message}`,
        event: AuditRecordEvent.DeleteUserGroup,
      });
      throw new Error('Error deleting user group');
    }

  });
