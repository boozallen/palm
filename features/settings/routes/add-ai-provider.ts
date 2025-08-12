import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { BadRequest, Unauthorized } from '@/features/shared/errors/routeErrors';
import {
  newAzureOpenAiConfig,
  newOpenAiConfig,
  newAnthropicConfig,
  newGeminiConfig,
  AiProviderType,
  ProviderConfig,
  hasApiEndpoint,
  newBedrockConfig,
  isBedrockConfig,
} from '@/features/shared/types';
import createProvider from '@/features/settings/dal/createProvider';
import { TOKEN_COST_RATE } from '@/features/shared/utils';

// Based on AiProviderFormValues
const inputSchema = z.object({
  label: z.string(),
  type: z.nativeEnum(AiProviderType),
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
    // Check if user has permission to add AI provider
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to add an AI provider');
    }

    // Build the correct kind of provider config based on the config type
    let config = null;
    switch (input.type) {
      case AiProviderType.OpenAi:
        config = newOpenAiConfig(input.apiKey, '');
        break;

      case AiProviderType.AzureOpenAi:
        config = newAzureOpenAiConfig(input.apiKey, input.apiEndpoint, '');
        break;

      case AiProviderType.Anthropic:
        config = newAnthropicConfig(input.apiKey);
        break;

      case AiProviderType.Gemini:
        config = newGeminiConfig(input.apiKey);
        break;

      case AiProviderType.Bedrock:
        config = newBedrockConfig(
          input.accessKeyId,
          input.secretAccessKey,
          input.region,
          input.sessionToken,
        );
        break;

      default:
        throw BadRequest(`Unsupported AI provider id: ${input.type}`);
    }

    const costPerInputToken = input.inputCostPerMillionTokens ? input.inputCostPerMillionTokens / TOKEN_COST_RATE : undefined;
    const costPerOutputToken = input.outputCostPerMillionTokens ? input.outputCostPerMillionTokens / TOKEN_COST_RATE : undefined;

    const provider = await createProvider({
      label: input.label,
      type: input.type,
      config: config as Exclude<ProviderConfig, 'id'>,
      costPerInputToken: costPerInputToken,
      costPerOutputToken: costPerOutputToken,
    });

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
