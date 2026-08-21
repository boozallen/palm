import { AiProviderType, hasApiEndpoint, isBedrockConfig } from '@/features/shared/types';
import { procedure } from '@/server/trpc';
import { z } from 'zod';
import getProvider from '@/features/settings/dal/ai-providers/getAiProvider';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

const inputSchema = z.object({
  id: z.string(),
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
  .query(async ({ input, ctx }) => {
    // check if user has permission to get AI provider
    if (ctx.userRole !== UserRole.Admin) {
      logger.warn('Unauthorized user trpc.profile.getAiProvider', { userId: ctx.userId });
      throw Forbidden('You do not have permission to access this resource');
    }

    const provider = await getProvider(input.id);

    const output: z.infer<typeof outputSchema> = {
      provider: {
        id: provider.id,
        typeId: provider.typeId,
        label: provider.label,
        config: {
          id: provider.config.id,
          apiEndpoint: hasApiEndpoint(provider.config) ? provider.config.apiEndpoint : null,
          region: isBedrockConfig(provider.config) ? provider.config.region : null,
        },
        inputCostPerMillionTokens: provider.costPerInputToken * TOKEN_COST_RATE,
        outputCostPerMillionTokens: provider.costPerOutputToken * TOKEN_COST_RATE,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      },
    };

    return output;
  });
