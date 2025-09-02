import { z } from 'zod';
import { procedure } from '@/server/trpc';
import addAiProviderModel from '@/features/settings/dal/ai-providers/addAiProviderModel';
import updateSystemConfigDefaultModel from '@/features/settings/dal/system-configurations/updateSystemConfigDefaultModel';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

const inputSchema = z.object({
  name: z.string(),
  externalId: z.string(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  aiProviderId: z.string().uuid(),
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
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to add a new model',
      });
    }

    const result = await addAiProviderModel({
      name: input.name,
      externalId: input.externalId,
      costPerInputToken: input.costPerMillionInputTokens / TOKEN_COST_RATE,
      costPerOutputToken: input.costPerMillionOutputTokens / TOKEN_COST_RATE,
      aiProviderId: input.aiProviderId,
    });

    await updateSystemConfigDefaultModel(result.id);

    const output: z.infer<typeof outputSchema> = {
      id: result.id,
      name: result.name,
      externalId: result.externalId,
      costPerMillionInputTokens: result.costPerInputToken * TOKEN_COST_RATE,
      costPerMillionOutputTokens: result.costPerOutputToken * TOKEN_COST_RATE,
      aiProviderId: result.aiProviderId,
      providerLabel: result.providerLabel,
    };

    return output;
  });
