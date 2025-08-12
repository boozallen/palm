import logger from '@/server/logger';
import db from '@/server/db';
import { AiProviderType, Provider, ProviderConfig } from '@/features/shared/types';

type UpdateAiProviderInput = {
  id: string; // UUID of AI provider
  label: string;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  apiKey: string,
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  apiEndpoint: string,
  region: string,
}

export default async function updateAiProvider(input: UpdateAiProviderInput): Promise<Provider> {
  return db.$transaction(async (tx): Promise<Provider> => {

    // Get the original AI provider so the unenforced foreign key is retrieved
    let aiProvider;

    try {
      aiProvider = await tx.aiProvider.findUnique({
        where: {
          id: input.id,
          deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

    } catch (error) {
      logger.error('There was an error retrieving the AI provider', error);
      throw new Error('There was an error retrieving the AI provider');
    }

    if (!aiProvider) {
      logger.warn(`AI Provider could not be found: ${input.id}`);
      throw new Error('AI Provider could not be found.');
    }

    if (aiProvider.deletedAt !== null) {
      logger.warn(`AI Provider is deleted and cannot be updated: ${input.id}`);
      throw new Error('AI Provider is deleted and cannot be updated.');
    }

    // There's no way of telling what fields are being updated.
    // This type allows us to dynamically build the data to update
    // the DB with based on whether or not secret values are provided
    // and what config fields the aiProvider requires.
    type UpdateProviderApiConfig = {
      apiKey?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      sessionToken?: string;
      apiEndpoint?: string;
      region?: string;
    }

    const newApiConfig: UpdateProviderApiConfig = {};
    const secretFields: (keyof UpdateProviderApiConfig)[] = [
      'apiKey',
      'accessKeyId',
      'secretAccessKey',
      'sessionToken',
    ];

    secretFields.forEach((field) => {
      if (input[field] && input[field].trim().length > 0) {
        newApiConfig[field] = input[field];
      }
    });

    try {
      const updatedProvider = await tx.aiProvider.update({
        where: { id: aiProvider.id, deletedAt: null },
        data: {
          label: input.label,
          costPerInputToken: input.costPerInputToken,
          costPerOutputToken: input.costPerOutputToken,
        },
      });

      // Only handles AI providers with 'editable' configurations.
      let updatedConfig: ProviderConfig;

      switch (aiProvider.aiProviderTypeId) {
        case AiProviderType.OpenAi: {
          const updatedOpenAiConfig = await tx.apiConfigOpenAi.update({
            where: {
              id: aiProvider.apiConfigId, deletedAt: null,
            },
            data: newApiConfig,
          });

          if (!updatedOpenAiConfig) {
            logger.warn('OpenAI provider config not found', { providerId: aiProvider.id, configId: aiProvider.apiConfigId });
            throw new Error('OpenAI provider config not found');
          }

          updatedConfig = {
            id: updatedOpenAiConfig.id,
            type: AiProviderType.OpenAi,
            apiKey: updatedOpenAiConfig.apiKey,
            orgKey: updatedOpenAiConfig.orgKey,
          };

          break;
        }
        case AiProviderType.AzureOpenAi: {
          newApiConfig.apiEndpoint = input.apiEndpoint;

          const updatedAzureConfig = await tx.apiConfigAzureOpenAi.update({
            where: {
              id: aiProvider.apiConfigId, deletedAt: null,
            },
            data: newApiConfig,
          });

          if (!updatedAzureConfig) {
            logger.warn('Azure OpenAI provider config not found', { providerId: aiProvider.id, configId: aiProvider.apiConfigId });
            throw new Error('Azure OpenAI provider config not found');
          }

          updatedConfig = {
            id: updatedAzureConfig.id,
            type: AiProviderType.AzureOpenAi,
            apiKey: updatedAzureConfig.apiKey,
            apiEndpoint: updatedAzureConfig.apiEndpoint,
            deploymentId: updatedAzureConfig.deploymentId,
          };

          break;
        }
        case AiProviderType.Anthropic: {
          const updatedAnthropicConfig = await tx.apiConfigAnthropic.update({
            where: {
              id: aiProvider.apiConfigId, deletedAt: null,
            },
            data: newApiConfig,
          });

          if (!updatedAnthropicConfig) {
            logger.warn('Anthropic provider config not found', { providerId: aiProvider.id, configId: aiProvider.apiConfigId });
            throw new Error('Anthropic provider config not found');
          }

          updatedConfig = {
            id: updatedAnthropicConfig.id,
            type: AiProviderType.Anthropic,
            apiKey: updatedAnthropicConfig.apiKey,
          };

          break;
        }
        case AiProviderType.Gemini: {
          const updatedGeminiConfig = await tx.apiConfigGemini.update({
            where: {
              id: aiProvider.apiConfigId, deletedAt: null,
            },
            data: newApiConfig,
          });

          if (!updatedGeminiConfig) {
            logger.warn('Gemini provider config not found', { providerId: aiProvider.id, configId: aiProvider.apiConfigId });
            throw new Error('Gemini provider config not found');
          }

          updatedConfig = {
            id: updatedGeminiConfig.id,
            type: AiProviderType.Gemini,
            apiKey: updatedGeminiConfig.apiKey,
          };

          break;
        }
        case AiProviderType.Bedrock: {
          newApiConfig.region = input.region;

          const updatedBedrockConfig = await tx.apiConfigBedrock.update({
            where: {
              id: aiProvider.apiConfigId, deletedAt: null,
            },
            data: newApiConfig,
          });

          if (!updatedBedrockConfig) {
            logger.warn('Bedrock provider config not found', { providerId: aiProvider.id, configId: aiProvider.apiConfigId });
            throw new Error('Bedrock provider config not found');
          }

          updatedConfig = {
            id: updatedBedrockConfig.id,
            type: AiProviderType.Bedrock,
            accessKeyId: updatedBedrockConfig.accessKeyId,
            secretAccessKey: updatedBedrockConfig.secretAccessKey,
            sessionToken: updatedBedrockConfig.sessionToken,
            region: updatedBedrockConfig.region,
          };
          break;
        }
        default:
          logger.warn(`Unsupported AI provider: ${AiProviderType[aiProvider.aiProviderTypeId]}`);
          throw new Error('Unsupported AI provider');
      }

      return {
        id: updatedProvider.id,
        typeId: updatedProvider.aiProviderTypeId,
        label: updatedProvider.label,
        configTypeId: updatedConfig.type,
        costPerInputToken: updatedProvider.costPerInputToken,
        costPerOutputToken: updatedProvider.costPerOutputToken,
        config: updatedConfig,
        createdAt: updatedProvider.createdAt,
        updatedAt: updatedProvider.updatedAt,
      };
    } catch (error) {
      logger.error('Error updating AI provider configuration', error);
      throw new Error('Error updating AI provider configuration');
    }
  });
}
