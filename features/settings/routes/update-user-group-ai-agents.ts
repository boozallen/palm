import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import updateUserGroupAiAgents from '@/features/settings/dal/updateUserGroupAiAgents';

const inputSchema = z.object({
  userGroupId: z.string().uuid(),
  aiAgentId: z.string().uuid(),
  enabled: z.boolean(),
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
  .mutation(async ({ ctx, input }) => {
    const { userGroupId, aiAgentId, enabled } = input;

    if (ctx.userRole !== UserRole.Admin) {
      const membership = await getUserGroupMembership(ctx.userId, userGroupId);
      if (!membership || membership.role !== UserGroupRole.Lead) {
        throw Forbidden('You do not have permission to access this resource');
      }
    }

    const result = await updateUserGroupAiAgents({
      userGroupId,
      aiAgentId,
      enabled,
    });
    
    const output: z.infer<typeof outputSchema> = {
      userGroupAiAgents: result.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
      })),
    };

    return output;
  });
