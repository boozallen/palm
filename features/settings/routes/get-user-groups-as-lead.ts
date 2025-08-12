import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { userGroupSchema, UserGroup } from '@/features/shared/types/user-group';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getUserGroupsAsLead from '@/features/settings/dal/getUserGroupsAsLead';

const outputSchema = z.object({
  userGroupsAsLead: z.array(userGroupSchema),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (!ctx.userId) {
    throw Unauthorized('You do not have permission to access this resource');
  }

  const result = await getUserGroupsAsLead(ctx.userId);

  const output: z.infer<typeof outputSchema> = {
    userGroupsAsLead: result.map(
      (userGroup): UserGroup => ({
        id: userGroup.id,
        label: userGroup.label,
        createdAt: userGroup.createdAt,
        updatedAt: userGroup.updatedAt,
        memberCount: userGroup.memberCount,
      })
    ),
  };

  return output;
});
