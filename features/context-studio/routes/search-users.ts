import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { userSearchQuery } from '@/features/context-studio/types/user-search';
import searchUsers from '@/features/context-studio/dal/searchUsers';

const outputSchema = z.object({
  records: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    role: z.string(),
    lastLoginAt: z.date().nullable(),
    groupCount: z.number(),
    spend: z.number(),
    tokens: z.number(),
  })),
  totalCount: z.number(),
});

export default procedure
  .input(userSearchQuery)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    return searchUsers(input);
  });
