import {
  AnthropicSource,
  AuditedSource,
  AzureOpenAISource,
  BedrockSource,
  GeminiSource,
  OpenAiSource,
  AiProviderUsageTracker,
} from './sources';

import buildProvider from '@/features/shared/dal/buildProvider';
import {
  AzureOpenAiConfig,
  BedrockConfig,
  OpenAiConfig,
  AnthropicConfig,
  GeminiConfig,
  Provider,
  AiProviderType,
} from '@/features/shared/types';
import db from '@/server/db';
import { Model } from '@/features/shared/types/model';
import logger from '@/server/logger';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { AiRepository } from './sources/types';
import { getConfig } from '@/server/config';

// Once the AIProvider model is in place, we may want to change this to:
//   type AiRepositoryConfig = Omit<AiProvider, 'id'>;
// Note: this type does not enforce required/optional fields- it's up to the
//       source to validate provided values before using them
export interface AiRepositoryConfig {
  type: AiProviderType;
  apiKey?: string | null;
  apiEndpoint?: string | null;
  deploymentId?: string | null;
  models?: string[];
}

type BuildResult = {
  source: AiRepository;
  provider: Provider;
  model: Model;
};

export type ProviderFunction = (
  sourceConfig: AiRepositoryConfig,
) => AiRepository;

export interface AIFactoryConfig {
  userId: string;
}

export class AIFactory {
  constructor(protected config: AIFactoryConfig) {
    if (!this.config.userId) {
      logger.error('Missing required configuration properties: config.userId');
      throw new Error('Missing required configuration properties');
    }
  }

  async buildSource(modelId: string): Promise<BuildResult> {
    // get the aiProvider and model information
    const result = await db.model.findUniqueOrThrow({
      where: { id: modelId, deletedAt: null },
      select: {
        aiProviderId: true,
        name: true,
        externalId: true,
        aiProvider: true,
        costPerInputToken: true,
        costPerOutputToken: true,
      },
    });

    let provider = await buildProvider(db, result.aiProvider);
    if (provider.typeId === AiProviderType.AzureOpenAi) {
      // override empty Provider.deploymentId with model's externalId
      const azureConfig = provider.config as AzureOpenAiConfig;
      if (!azureConfig.deploymentId) {
        azureConfig.deploymentId = result.externalId;
      }
    }

    return {
      source: this.buildClient(provider),
      provider,
      model: {
        id: modelId,
        name: result.name,
        aiProviderId: result.aiProviderId,
        externalId: result.externalId,
        costPerInputToken: result.costPerInputToken,
        costPerOutputToken: result.costPerOutputToken,
      },
    };
  }

  async buildUserSource(modelId: string): Promise<BuildResult> {
    const result = await this.buildSource(modelId);
    return {
      source: await this.wrapAiProviderUsageTracker(
        this.wrapAudit(result.source),
        modelId,
        false,
      ),
      provider: result.provider,
      model: result.model,
    };
  }

  async buildSystemSource(modelId?: string): Promise<BuildResult> {
    const systemConfigResult = await getSystemConfig();

    const selectedModelId =
      modelId ?? systemConfigResult.systemAiProviderModelId;

    if (!selectedModelId) {
      throw new Error('This system is not configured for use at this time');
    }

    const result = await this.buildSource(selectedModelId);

    return {
      source: await this.wrapAiProviderUsageTracker(
        this.wrapAudit(result.source),
        selectedModelId,
        true,
      ),
      provider: result.provider,
      model: result.model,
    };
  }

  private buildClient(provider: Provider): AiRepository {
    switch (provider.configTypeId) {
      case AiProviderType.OpenAi: {
        const cfg = provider.config as OpenAiConfig;
        return new OpenAiSource(cfg.apiKey);
      }
      case AiProviderType.AzureOpenAi: {
        const cfg = provider.config as AzureOpenAiConfig;
        return new AzureOpenAISource(
          cfg.apiKey,
          cfg.apiEndpoint,
          cfg.deploymentId,
        );
      }
      case AiProviderType.Anthropic: {
        const cfg = provider.config as AnthropicConfig;
        return new AnthropicSource(cfg.apiKey);
      }
      case AiProviderType.Gemini: {
        const cfg = provider.config as GeminiConfig;
        return new GeminiSource(cfg.apiKey);
      }
      case AiProviderType.Bedrock: {
        let cfg = provider.config as BedrockConfig;

        if (!cfg.accessKeyId || !cfg.secretAccessKey) {
          const config = getConfig();
          cfg = { ...config.bedrock, type: AiProviderType.Bedrock };
        }

        return new BedrockSource(cfg);
      }
      default:
        logger.error(`Unsupported provider type: ${provider.configTypeId}`);
        throw new Error('Unsupported provider type');
    }
  }

  protected async wrapAudit(
    source: AiRepository | Promise<AiRepository>,
  ): Promise<AiRepository> {
    return new AuditedSource(await source, this.config.userId, db);
  }

  protected async wrapAiProviderUsageTracker(
    source: AiRepository | Promise<AiRepository>,
    modelId: string,
    system: boolean,
  ): Promise<AiRepository> {
    return new AiProviderUsageTracker(
      await source,
      this.config.userId,
      modelId,
      system,
    );
  }
}
