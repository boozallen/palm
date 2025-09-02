import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getAiAgents from '@/features/settings/dal/ai-agents/getAiAgents';
import { AiAgentType } from '@/features/shared/types';

const outputSchema = z.object({
  aiAgents: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      description: z.string(),
      type: z.nativeEnum(AiAgentType),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  if (ctx.userRole !== UserRole.Admin) {
    throw Forbidden('You do not have permission to access this resource.');
  }

  const result = await getAiAgents();

  // Note: agent.label maps to database field 'name' for consistency with UI naming convention
  return {
    aiAgents: result.map((agent) => ({
      id: agent.id,
      label: agent.label,
      description: agent.description,
      type: agent.type,
    })),
  };
});
