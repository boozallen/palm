import { z } from 'zod';
import getAvailableModels from '@/features/shared/dal/getAvailableModels';
import { procedure } from '@/server/trpc';

const inputSchema = z.object({});

const outputSchema = z.object({
  availableModels: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    providerLabel: z.string(),
  })),
});

type GetAvailableModelsOutput = z.infer<typeof outputSchema>;

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const results = await getAvailableModels(ctx.userId);

    const output: GetAvailableModelsOutput = {
      availableModels: [],
    };

    for (const result of results) {
      output.availableModels.push({
        id: result.id,
        name: result.name,
        providerLabel: result.providerLabel,
      });
    }

    return output;
  });
