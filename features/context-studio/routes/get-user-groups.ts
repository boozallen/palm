import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getStudioUserGroups from '@/features/context-studio/dal/getStudioUserGroups';
import getUserContextStudioAccess from '@/features/shared/dal/getUserContextStudioAccess';

const outputSchema = z.object({
  userGroups: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
    })
  ),
});

// The studio needs its own group lookup because the Settings equivalent is gated
// to Admins and group Leads. Reusing it left the filter bar empty and disabled
// for the plain members the Context Studio grant admits.
export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const hasAccess = await getUserContextStudioAccess(ctx.userId);

    if (!hasAccess) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const userGroups = await getStudioUserGroups(ctx.userId, ctx.userRole === UserRole.Admin);

    return { userGroups };
  });
