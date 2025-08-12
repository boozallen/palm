import { z } from 'zod';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { procedure } from '@/server/trpc';
import { AiAgentType } from '@/features/shared/types/ai-agent';

const outputSchema = z.object({
  availableAgents: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      type: z.nativeEnum(AiAgentType),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const results = await getAvailableAgents(ctx.userId);

  return {
    availableAgents: results.map((result) => ({
      id: result.id,
      name: result.name,
      description: result.description,
      type: result.type,
    })),
  };
});
