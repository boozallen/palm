import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAiAgents from '@/features/settings/dal/ai-agents/getAiAgents';

const outputSchema = z.object({
  aiAgents: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      enabled: z.boolean(),
    })
  ),
});  

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (ctx.userRole !== UserRole.Admin) {
    throw Forbidden('You do not have permission to access this resource.');
  }

  const result = await getAiAgents();
 
  return {
    aiAgents: result.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      enabled: agent.enabled,
    })),
  };
});
