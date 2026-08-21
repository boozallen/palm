import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import createAgentProvider from '@/features/settings/dal/agent-providers/createAgentProvider';

const inputSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
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
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to add an agent provider');
    }

    const provider = await createAgentProvider({
      name: input.name,
      description: input.description,
      endpoint: input.endpoint,
      apiKey: input.apiKey,
    });

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
