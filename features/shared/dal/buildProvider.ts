import { AiProvider, PrismaClient } from '@prisma/client';
import logger from '@/server/logger';
import {
  newAzureOpenAiConfig,
  newOpenAiConfig,
  newAnthropicConfig,
  newGeminiConfig,
  Provider,
  AiProviderType,
  newBedrockConfig,
} from '@/features/shared/types';

export default async function buildProvider(db: PrismaClient, p: AiProvider): Promise<Provider> {
  let config = null;
  try {
    // For each provider, fetch the config based on the provider type
    switch (p.aiProviderTypeId) {
      case AiProviderType.OpenAi: {
        const result = await db.apiConfigOpenAi.findUnique({
          where: { id: p.apiConfigId, deletedAt: !!p.deletedAt ? { not: null } : null },
        });
        if (!result) {
          logger.warn('OpenAI provider config not found', { providerId: p.id, configId: p.apiConfigId });
          throw new Error('OpenAI provider config not found');
        }
        config = {
          id: result.id,
          ...newOpenAiConfig(result.apiKey, result.orgKey),
        };
        break;
      }
      case AiProviderType.AzureOpenAi: {
        const result = await db.apiConfigAzureOpenAi.findUnique({
          where: { id: p.apiConfigId, deletedAt: !!p.deletedAt ? { not: null } : null },
        });
        if (!result) {
          logger.warn('Azure OpenAI provider config not found', { providerId: p.id, configId: p.apiConfigId });
          throw new Error('Azure OpenAI provider config not found');
        }
        config = {
          id: result.id,
          ...newAzureOpenAiConfig(result.apiKey, result.apiEndpoint, result.deploymentId),
        };
        break;
      }
      case AiProviderType.Anthropic: {
        const result = await db.apiConfigAnthropic.findUnique({
          where: { id: p.apiConfigId, deletedAt: !!p.deletedAt ? { not: null } : null },
        });
        if (!result) {
          logger.warn('Anthropic provider config not found', { providerId: p.id, configId: p.apiConfigId });
          throw new Error('Anthropic provider config not found');
        }
        config = {
          id: result.id,
          ...newAnthropicConfig(result.apiKey),
        };
        break;
      }
      case AiProviderType.Gemini: {
        const result = await db.apiConfigGemini.findUnique({
          where: { id: p.apiConfigId, deletedAt: !!p.deletedAt ? { not: null } : null },
        });
        if (!result) {
          logger.warn('Gemini provider config not found', { providerId: p.id, configId: p.apiConfigId });
          throw new Error('Gemini provider config not found');
        }
        config = {
          id: result.id,
          ...newGeminiConfig(result.apiKey),
        };
        break;
      }
      case AiProviderType.Bedrock: {
        const result = await db.apiConfigBedrock.findUnique({
          where: { id: p.apiConfigId, deletedAt: p.deletedAt ? { not: null } : null },
        });

        if (!result) {
          logger.warn('Bedrock provider config not found', { providerId: p.id, configId: p.apiConfigId });
          throw new Error('Bedrock provider config not found');
        }

        config = {
          id: result.id,
          ...newBedrockConfig(
            result.accessKeyId,
            result.secretAccessKey,
            result.region,
            result.sessionToken,
          ),
        };
        break;
      }
      default: {
        logger.warn('Error fetching AI provider config', { providerId: p.id, providerTypeId: p.aiProviderTypeId });
        throw new Error('Error fetching AI provider config');
      }
    }
    return {
      id: p.id,
      typeId: p.aiProviderTypeId,
      label: p.label,
      configTypeId: p.apiConfigType,
      config,
      costPerInputToken: p.costPerInputToken,
      costPerOutputToken: p.costPerOutputToken,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  } catch (error) {
    logger.error('Error fetching AI provider config', error);
    throw new Error('Error fetching AI provider config');
  }
}
