import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { z } from 'zod';
import getUserGroupAiAgents from '@/features/settings/dal/getUserGroupAiAgents';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import { UserGroupRole } from '@/features/shared/types/user-group';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
});

const outputSchema = z.object({
  userGroupAiAgents: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
    })
  ),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input: { userGroupId }, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const result = await getUserGroupAiAgents(userGroupId);

    const output: z.infer<typeof outputSchema> = {
      userGroupAiAgents: result.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
      })),
    };

    return output;
  });
