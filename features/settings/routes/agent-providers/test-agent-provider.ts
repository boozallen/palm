import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';
import logger from '@/server/logger';

const inputSchema = z.object({
  agentProviderId: z.string().uuid(),
});

const outputSchema = z.object({
  text: z.string(),
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

    try {
      const agentProvider = await getAgentProvider(input.agentProviderId);
      if (!agentProvider) {
        return {
          text: '',
          isValid: false,
          errorMessage: 'Agent provider not found',
        };
      }

      const testMessage = 'Test connection';

      let upstream: Response;
      try {
        upstream = await fetch(`${agentProvider.endpoint}/sessions/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(agentProvider.apiKey ? { 'Authorization': `Bearer ${agentProvider.apiKey}` } : {}),
          },
          body: JSON.stringify({
            idea: testMessage,
            prd_path: '',
          }),
        });
      } catch (err) {
        logger.error(`[AGENT-PROVIDER/test] Connection failed to ${agentProvider.name}`, err);
        return {
          text: '',
          isValid: false,
          errorMessage: err instanceof Error ? err.message : 'Service unreachable',
        };
      }

      if (!upstream.ok) {
        let errorMessage = `HTTP ${upstream.status}`;
        try {
          const text = await upstream.text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              errorMessage = parsed.detail || parsed.message || text;
            } catch {
              errorMessage = text;
            }
          }
        } catch {
          errorMessage = `HTTP ${upstream.status}`;
        }
        logger.error(`[AGENT-PROVIDER/test] Request failed to ${agentProvider.name}`, { status: upstream.status, errorMessage });
        return {
          text: '',
          isValid: false,
          errorMessage,
        };
      }

      const data = await upstream.json() as Record<string, unknown>;
      const sessionId = data['session_id'] as string | undefined;

      if (!sessionId) {
        logger.error('[AGENT-PROVIDER/test] No session_id in response', { responseData: data });
        return {
          text: '',
          isValid: false,
          errorMessage: 'Invalid response: missing session_id',
        };
      }

      logger.info('[AGENT-PROVIDER/test] Test successful', { sessionId });

      return {
        text: `Session created successfully: ${sessionId}`,
        isValid: true,
      };
    } catch (err) {
      logger.error('[AGENT-PROVIDER/test] test failed', err);
      return {
        text: '',
        isValid: false,
        errorMessage: err instanceof Error ? err.message : 'Internal server error',
      };
    }
  });
