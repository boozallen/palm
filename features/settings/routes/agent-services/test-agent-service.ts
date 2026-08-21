import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { getConfig } from '@/server/config';
import logger from '@/server/logger';

const inputSchema = z.object({
  serviceId: z.enum(['langgraph', 'claude']),
});

const outputSchema = z.object({
  isValid: z.boolean(),
  errorMessage: z.string().optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const config = getConfig();
    const { langgraphServiceUrl, claudeServiceUrl } = config.agentServices;

    let endpoint: string;
    let serviceName: string;

    switch (input.serviceId) {
      case 'langgraph':
        endpoint = langgraphServiceUrl;
        serviceName = 'LangGraph';
        break;
      case 'claude':
        endpoint = claudeServiceUrl;
        serviceName = 'Claude';
        break;
    }

    try {
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        logger.info(`[AGENT-SERVICE/test] ${serviceName} health check successful`, {
          serviceId: input.serviceId,
          endpoint,
        });
        return { isValid: true };
      } else {
        logger.error(`[AGENT-SERVICE/test] ${serviceName} health check failed`, {
          serviceId: input.serviceId,
          status: response.status,
          endpoint,
        });
        return {
          isValid: false,
          errorMessage: `Service returned status ${response.status}`,
        };
      }
    } catch (fetchError) {
      logger.error(`[AGENT-SERVICE/test] ${serviceName} is unreachable`, {
        serviceId: input.serviceId,
        error: fetchError,
        endpoint,
      });
      return {
        isValid: false,
        errorMessage: fetchError instanceof Error ? fetchError.message : 'Service is unreachable or timed out',
      };
    }
  });
