import { procedure } from '@/server/trpc';
import updateAiProvider from '@/features/settings/dal/ai-providers/updateAiProvider';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';
import { AiProviderType, hasApiEndpoint, isBedrockConfig } from '@/features/shared/types';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

const inputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  apiKey: z.string(),
  apiEndpoint: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  sessionToken: z.string(),
  region: z.string(),
  inputCostPerMillionTokens: z.number().optional(),
  outputCostPerMillionTokens: z.number().optional(),
});

const outputSchema = z.object({
  provider: z.object({
    id: z.string(),
    typeId: z.nativeEnum(AiProviderType),
    label: z.string(),
    config: z.object({
      id: z.string(),
      apiEndpoint: z.string().nullable(),
      region: z.string().nullable(),
    }),
    inputCostPerMillionTokens: z.number(),
    outputCostPerMillionTokens: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {

    if (ctx.userRole !== UserRole.Admin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }

    const costPerInputToken = input.inputCostPerMillionTokens !== undefined ? input.inputCostPerMillionTokens / TOKEN_COST_RATE : undefined;
    const costPerOutputToken = input.outputCostPerMillionTokens !== undefined ? input.outputCostPerMillionTokens / TOKEN_COST_RATE : undefined;

    const result = await updateAiProvider({
      id: input.id,
      label: input.label,
      apiKey: input.apiKey,
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
      sessionToken: input.sessionToken,
      apiEndpoint: input.apiEndpoint,
      region: input.region,
      costPerInputToken: costPerInputToken,
      costPerOutputToken: costPerOutputToken,
    });

    return {
      provider: {
        id: result.id,
        typeId: result.typeId,
        label: result.label,
        config: {
          id: result.config.id,
          apiEndpoint: hasApiEndpoint(result.config) ? result.config.apiEndpoint : null,
          region: isBedrockConfig(result.config) ? result.config.region : null,
        },
        inputCostPerMillionTokens: result.costPerInputToken * TOKEN_COST_RATE,
        outputCostPerMillionTokens: result.costPerOutputToken * TOKEN_COST_RATE,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    };
  });
