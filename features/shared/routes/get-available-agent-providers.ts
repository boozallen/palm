import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getAvailableAgentProviders from '@/features/shared/dal/getAvailableAgentProviders';

const outputSchema = z.object({
  availableAgentProviders: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
    })
  ),
});

export default procedure.output(outputSchema).query(async ({ ctx }) => {
  const providers = await getAvailableAgentProviders(ctx.userId);

  return {
    availableAgentProviders: providers.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    })),
  };
});
