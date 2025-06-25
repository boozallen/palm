import { z } from 'zod';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { procedure } from '@/server/trpc';

const outputSchema = z.object({
  availableAgents: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      enabled: z.boolean(),
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
      enabled: result.enabled,
    })),
  };
});
