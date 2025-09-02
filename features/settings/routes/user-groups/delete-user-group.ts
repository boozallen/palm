import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import deleteUserGroup from '@/features/settings/dal/user-groups/deleteUserGroup';
import getUser from '@/features/settings/dal/shared/getUser';
import getUserGroup from '@/features/settings/dal/user-groups/getUserGroup';

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
        outcome: 'WARN',
        description: `User ${currentUser?.name} attempted to delete user group ${userGroup?.label} but lacked permissions`,
        event: 'DELETE_USER_GROUP',
      });
      throw Forbidden('You do not have permission to access this resource');
    }

    try {
      const result = await deleteUserGroup(id);

      ctx.auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User ${currentUser?.name} deleted user group ${userGroup?.label}`,
        event: 'DELETE_USER_GROUP',
      });

      return { id: result.id };

    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `User ${currentUser?.name} failed to delete user group ${userGroup?.label}: ${(error as Error).message}`,
        event: 'DELETE_USER_GROUP',
      });
      throw new Error('Error deleting user group');
    }

  });
