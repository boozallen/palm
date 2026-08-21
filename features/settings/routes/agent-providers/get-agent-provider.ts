import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  agentProvider: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    endpoint: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to view agent providers');
    }

    const provider = await getAgentProvider(input.id);

    return {
      agentProvider: {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        endpoint: provider.endpoint,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      },
    };
  });
