import { z } from 'zod';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { procedure } from '@/server/trpc';
import { AiAgentType } from '@/features/shared/types/ai-agent';

const outputSchema = z.object({
  availableAgents: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      description: z.string(),
      type: z.nativeEnum(AiAgentType),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const results = await getAvailableAgents(ctx.userId);

  // Note: result.label maps to database field 'name' for consistency with UI naming convention
  return {
    availableAgents: results.map((result) => ({
      id: result.id,
      label: result.label,
      description: result.description,
      type: result.type,
    })),
  };
});
