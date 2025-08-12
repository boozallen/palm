import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/settings/dal/getUserGroups';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

const outputSchema = z.object({
  userGroups: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
      memberCount: z.number(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (ctx.userRole !== UserRole.Admin) {
    const lead = await getIsUserGroupLead(ctx.userId);
    if (!lead) {
      throw Unauthorized('You do not have permission to access this resource');
    }
  }

  const result = await getUserGroups();

  const output: z.infer<typeof outputSchema> = {
    userGroups: result.map((userGroup) => ({
      id: userGroup.id,
      label: userGroup.label,
      createdAt: userGroup.createdAt,
      updatedAt: userGroup.updatedAt,
      memberCount: userGroup.memberCount,
    })),
  };

  return output;
});
