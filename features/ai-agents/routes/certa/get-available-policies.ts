import { z } from 'zod';
import getAvailablePolicies from '@/features/ai-agents/dal/certa/getAvailablePolicies';
import { procedure } from '@/server/trpc';
import { Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  agentId: z.string(),
  search: z.string().optional(),
  limit: z.number().default(10),
});

const outputSchema = z.object({
  policies: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    requirements: z.string(),
  })),
});

type GetAvailablePolicies = z.infer<typeof outputSchema>;

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    const { agentId, search, limit } = input;
    const agents = await getAvailableAgents(ctx.userId);

    if (!agents.find(agent => agent.id === agentId)) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const results = await getAvailablePolicies(ctx.userId, agentId, search, limit);

    const output: GetAvailablePolicies = {
      policies: results.map((policy: Policy) => ({
        id: policy.id,
        title: policy.title,
        content: policy.content,
        requirements: policy.requirements,
      })),
    };

    return output;
  });
