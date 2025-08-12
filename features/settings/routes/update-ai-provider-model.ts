import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import updateAiProviderModel from '@/features/settings/dal/updateAiProviderModel';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

const inputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  externalId: z.string(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
});

const outputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  externalId: z.string(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  aiProviderId: z.string().uuid(),
  providerLabel: z.string(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to update a model');
    }

    const result = await updateAiProviderModel({
      id: input.id,
      name: input.name,
      externalId: input.externalId,
      costPerInputToken: input.costPerMillionInputTokens / TOKEN_COST_RATE,
      costPerOutputToken: input.costPerMillionOutputTokens / TOKEN_COST_RATE,
    });

    return {
      id: result.id,
      name: result.name,
      externalId: result.externalId,
      costPerMillionInputTokens: result.costPerInputToken * TOKEN_COST_RATE,
      costPerMillionOutputTokens: result.costPerOutputToken * TOKEN_COST_RATE,
      aiProviderId: result.aiProviderId,
      providerLabel: result.providerLabel,
    };
  });
