import {
  AnthropicSource,
  AuditedSource,
  AzureOpenAISource,
  BedrockSource,
  GeminiSource,
  OpenAiSource,
  AiProviderUsageTracker,
} from './sources';
import { UsageAttribution } from './sources/AiProviderUsageTracker';

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
import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';
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

export type BuildResult = {
  source: AiRepository;
  provider: Provider;
  model: Model;
};

export type BuildUserSourceOptions = {
  agent?: boolean;
  auditContext?: Record<string, unknown>;
  attribution?: UsageAttribution;
};

export type ProviderFunction = (
  sourceConfig: AiRepositoryConfig,
) => AiRepository;

export interface AIFactoryConfig {
  userId: string;
  // Which user group this factory instance's usage should be attributed to,
  // chosen by the user when they started the chat/workflow/job/run. Absent for
  // users with only one group, or for surfaces not yet gated on group selection.
  userGroupId?: string;
}

export class AIFactory {
  constructor(protected config: AIFactoryConfig) {
    if (!this.config.userId) {
      logger.error('Missing required configuration properties: config.userId');
      throw new Error('Missing required configuration properties');
    }
  }

  async buildSource(modelId: string, opts?: { requestTimeoutMs?: number }): Promise<BuildResult> {
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
      source: this.buildClient(provider, opts),
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

  async buildUserSource(modelId: string, opts?: BuildUserSourceOptions): Promise<BuildResult> {
    const result = await this.buildSource(modelId);
    return this.wrapUserSource(result, modelId, opts);
  }

  // Split out from buildUserSource so callers that cache the unwrapped provider
  // can re-wrap it per request. The wrappers carry per-request identity (userId,
  // audit context, usage attribution), so a cached wrapped source would attribute
  // one caller's calls to another.
  async wrapUserSource(base: BuildResult, modelId: string, opts?: BuildUserSourceOptions): Promise<BuildResult> {
    return {
      source: await this.wrapAiProviderUsageTracker(
        this.wrapAudit(base.source, opts?.auditContext),
        modelId,
        false,
        opts?.agent ?? false,
        false,
        opts?.attribution,
      ),
      provider: base.provider,
      model: base.model,
    };
  }

  async buildSystemSource(
    modelId?: string,
    opts?: { requestTimeoutMs?: number },
  ): Promise<BuildResult> {
    const systemConfigResult = await getSystemConfig();

    const selectedModelId =
      modelId ?? systemConfigResult.systemAiProviderModelId;

    if (!selectedModelId) {
      throw new Error('This system is not configured for use at this time');
    }

    const result = await this.buildSource(selectedModelId, opts);

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

  async buildKnowledgeGraphSource(
    opts?: { requestTimeoutMs?: number; attribution?: UsageAttribution },
  ): Promise<BuildResult> {
    const systemConfigResult = await getSystemConfig();

    const selectedModelId =
      systemConfigResult.knowledgeGraphAiProviderModelId;

    if (!selectedModelId) {
      throw new Error(
        'No AI provider model configured for knowledge graph operations',
      );
    }

    const result = await this.buildSource(selectedModelId, opts);

    return {
      source: await this.wrapAiProviderUsageTracker(
        this.wrapAudit(result.source),
        selectedModelId,
        false,
        false,
        true,
        opts?.attribution,
      ),
      provider: result.provider,
      model: result.model,
    };
  }

  // Embeddings run on the model an admin designated embeddings-only, never on the
  // chat model the caller happens to have. Building the source here keeps its cost
  // priced at that model's own rate and tagged as embedding spend, instead of being
  // folded into whichever model the caller passed in.
  //
  // modelId lets a caller that already resolved the designated model — a worker
  // that checked availability up front, for instance — pass it straight through
  // instead of paying for a second lookup. Omitted, it is resolved from the
  // factory's user, which is what every ordinary caller wants.
  async buildEmbeddingSource(
    modelId?: string,
    opts?: { requestTimeoutMs?: number; attribution?: UsageAttribution },
  ): Promise<BuildResult> {
    const embeddingModelId =
      modelId ?? (await getEmbeddingModel(this.config.userId))?.id;

    if (!embeddingModelId) {
      throw new Error(
        'No embedding model is configured. Ask an administrator to designate a model as embeddings only on an AI provider you have access to.',
      );
    }

    const result = await this.buildSource(embeddingModelId, opts);

    return {
      source: await this.wrapAiProviderUsageTracker(
        this.wrapAudit(result.source),
        embeddingModelId,
        false,
        false,
        false,
        opts?.attribution,
        true,
      ),
      provider: result.provider,
      model: result.model,
    };
  }

  private buildClient(provider: Provider, opts?: { requestTimeoutMs?: number }): AiRepository {
    switch (provider.configTypeId) {
      case AiProviderType.OpenAi: {
        const cfg = provider.config as OpenAiConfig;
        return new OpenAiSource(cfg.apiKey, provider.configTypeId);
      }
      case AiProviderType.AzureOpenAi: {
        const cfg = provider.config as AzureOpenAiConfig;
        return new AzureOpenAISource(
          cfg.apiKey,
          cfg.apiEndpoint,
          cfg.deploymentId,
          provider.configTypeId,
        );
      }
      case AiProviderType.Anthropic: {
        const cfg = provider.config as AnthropicConfig;
        return new AnthropicSource(cfg.apiKey, provider.configTypeId);
      }
      case AiProviderType.Gemini: {
        const cfg = provider.config as GeminiConfig;
        return new GeminiSource(cfg.apiKey, provider.configTypeId);
      }
      case AiProviderType.Bedrock: {
        let cfg = provider.config as BedrockConfig;

        if (!cfg.accessKeyId || !cfg.secretAccessKey) {
          const config = getConfig();
          cfg = { ...config.bedrock, type: AiProviderType.Bedrock };
        }

        return new BedrockSource(cfg, provider.configTypeId, opts);
      }
      default:
        logger.error(`Unsupported provider type: ${provider.configTypeId}`);
        throw new Error('Unsupported provider type');
    }
  }

  protected async wrapAudit(
    source: AiRepository | Promise<AiRepository>,
    context?: Record<string, unknown>,
  ): Promise<AiRepository> {
    return new AuditedSource(await source, this.config.userId, db, context ?? {});
  }

  protected async wrapAiProviderUsageTracker(
    source: AiRepository | Promise<AiRepository>,
    modelId: string,
    system: boolean,
    agent: boolean = false,
    knowledgeGraph: boolean = false,
    attribution?: UsageAttribution,
    embedding: boolean = false,
  ): Promise<AiRepository> {
    return new AiProviderUsageTracker(
      await source,
      this.config.userId,
      modelId,
      system,
      agent,
      knowledgeGraph,
      attribution ?? {},
      embedding,
      this.config.userGroupId,
    );
  }
}
