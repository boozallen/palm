import { z } from 'zod';

import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { procedure } from '@/server/trpc';
import updateUserRole from '@/features/settings/dal/admins/updateUserRole';
import getUser from '@/features/settings/dal/shared/getUser';

const inputSchema = z.object({
  id: z.string().uuid(),
  role: z.nativeEnum(UserRole),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().nullable(),
  role: z.nativeEnum(UserRole),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    const currentUser = await getUser(ctx.userId);
    const targetedUser = await getUser(input.id);

    if (ctx.userRole !== UserRole.Admin) {
      ctx.auditor.createAuditRecord({
        outcome: 'WARN',
        description: `${currentUser?.name} attempted to update user role of ${targetedUser?.name} from ${targetedUser?.role} to ${input.role} but lacked permissions`,
        event: 'MODIFY_USER_ROLE',
      });
      throw Forbidden('You do not have permission to access this resource.');
    } else if (ctx.userId === input.id) {
      ctx.auditor.createAuditRecord({
        outcome: 'WARN',
        description: `${currentUser?.name} attempted to update their user role from ${targetedUser?.role} to ${input.role}`,
        event: 'MODIFY_USER_ROLE',
      });
      throw BadRequest('You cannot change your own role.');
    }

    try {
      const updatedUser = await updateUserRole(input.id, input.role);

      const output: z.infer<typeof outputSchema> = {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      };

      ctx.auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `${currentUser?.name} updated user role of ${updatedUser.name} from ${targetedUser?.role} to ${updatedUser.role}`,
        event: 'MODIFY_USER_ROLE',
      });
      return output;
    } catch (error) {
      ctx.auditor.createAuditRecord({
        outcome: 'ERROR',
        description: `${currentUser?.name} failed to update user role of ${targetedUser?.name} from ${targetedUser?.role} to ${input.role}: ${(error as Error).message}`,
        event: 'MODIFY_USER_ROLE',
      });

      throw new Error('Error updating user role');
    }
  });
