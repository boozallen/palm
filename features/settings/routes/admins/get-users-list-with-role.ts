import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import getUsers from '@/features/settings/dal/shared/getUsers';

const inputSchema = z.object({
  searchQuery: z.string(),
  userId: z.string().uuid().optional(),
});

const outputSchema = z.object({
  users: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email().nullable(),
      role: z.nativeEnum(UserRole),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const users = await getUsers(input.searchQuery, input.userId);

    const output = {
      users: users.map((user) => {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }),
    };

    return output;
  });
