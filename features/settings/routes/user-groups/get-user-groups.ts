import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/settings/dal/user-groups/getUserGroups';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

const outputSchema = z.object({
  userGroups: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      joinCode: z.string().nullable().optional(),
      createdAt: z.date(),
      updatedAt: z.date(),
      graphDatabaseEnabled: z.boolean(),
      workflowsEnabled: z.boolean(),
      agenticChatEnabled: z.boolean(),
      contextStudioEnabled: z.boolean(),
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
      joinCode: userGroup.joinCode,
      createdAt: userGroup.createdAt,
      updatedAt: userGroup.updatedAt,
      graphDatabaseEnabled: userGroup.graphDatabaseEnabled,
      workflowsEnabled: userGroup.workflowsEnabled,
      agenticChatEnabled: userGroup.agenticChatEnabled,
      contextStudioEnabled: userGroup.contextStudioEnabled,
      memberCount: userGroup.memberCount,
    })),
  };

  return output;
});
