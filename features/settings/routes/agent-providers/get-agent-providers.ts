import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import getAgentProviders from '@/features/settings/dal/agent-providers/getAgentProviders';

const outputSchema = z.object({
  agentProviders: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      endpoint: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to view agent providers');
    }

    const providers = await getAgentProviders();

    return {
      agentProviders: providers.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        endpoint: p.endpoint,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  });
