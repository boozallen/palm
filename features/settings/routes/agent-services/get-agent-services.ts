import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { getConfig } from '@/server/config';

const outputSchema = z.object({
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      endpoint: z.string(),
    })
  ),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const config = getConfig();
    const { langgraphServiceUrl, claudeServiceUrl } = config.agentServices;

    const services = [
      {
        id: 'langgraph',
        name: 'LangGraph',
        description: 'LangGraph agent service for graph-based workflows',
        endpoint: langgraphServiceUrl,
      },
      {
        id: 'claude',
        name: 'Claude',
        description: 'Claude agent service for AI-powered interactions',
        endpoint: claudeServiceUrl,
      },
    ];

    return { services };
  });
