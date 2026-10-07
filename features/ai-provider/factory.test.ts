import logger from '@/server/logger';
import { AIFactory } from './factory';
import { AiProviderType, Provider, ProviderConfig } from '@/features/shared/types';
import { AiProviderUsageTracker, AuditedSource, BedrockSource } from './sources';
import { UsageAttribution } from './sources/AiProviderUsageTracker';
import { getConfig } from '@/server/config';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';

jest.mock('./sources', () => ({
  BedrockSource: jest.fn(),
  AuditedSource: jest.fn().mockImplementation((source) => source),
  AiProviderUsageTracker: jest.fn().mockImplementation((source) => source),
}));
jest.mock('@/server/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    bedrock: {},
    featureFlags: {},
  }),
}));
jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/features/shared/dal/getEmbeddingModel');

const mockAIFactoryConfig = {
  userId: 'test-user-id',
};

describe('AIFactory class', () => {

  describe('constructor', () => {
    it('should succeed with properly structured configuration', async () => {
      expect(() => new AIFactory(mockAIFactoryConfig)).not.toThrow();
    });

    it('should fail when config is incomplete', () => {
      const incompleteConfig = {
        // Intentionally missing 'userId' '
      };
      expect(() => new AIFactory(incompleteConfig as any)).toThrow('Missing required configuration properties');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('buildClient', () => {
    const mockBedrockConfig: ProviderConfig = {
      id: '08448b83-6f73-49dc-9142-84ea722a162c',
      type: AiProviderType.Bedrock,
      accessKeyId: 'testAccessKeyId',
      secretAccessKey: 'testSecret',
      region: 'us-east-1',
    };

    const mockProvider: Provider = {
      id: 'ca60ed47-d7bf-4cb9-80b7-9fadc43ab99e',
      typeId: AiProviderType.Bedrock,
      label: 'Mock Provider',
      configTypeId: AiProviderType.Bedrock,
      config: mockBedrockConfig,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let aiFactory: AIFactory;

    beforeEach(() => {
      jest.clearAllMocks();

      aiFactory = new AIFactory(mockAIFactoryConfig);
    });

    it('builds bedrock client', () => {
      aiFactory['buildClient'](mockProvider);
      expect(BedrockSource).toHaveBeenCalled();
    });

    it('resorts to env config if accessKeyId is missing', () => {
      const missingBedrockConfig = {
        ...mockBedrockConfig,
        accessKeyId: '',
      };

      aiFactory['buildClient']({
        ...mockProvider,
        config: missingBedrockConfig,
      });

      expect(getConfig as jest.Mock).toHaveBeenCalled();
    });
  });

  describe('buildKnowledgeGraphSource', () => {
    const mockGetSystemConfig = getSystemConfig as jest.MockedFunction<typeof getSystemConfig>;

    let factory: AIFactory;

    beforeEach(() => {
      jest.clearAllMocks();
      factory = new AIFactory(mockAIFactoryConfig);
    });

    it('should use knowledgeGraphAiProviderModelId when configured', async () => {
      mockGetSystemConfig.mockResolvedValue({
        knowledgeGraphAiProviderModelId: 'kg-model-id',
        systemAiProviderModelId: 'system-model-id',
      } as any);

      const mockBuildResult = {
        source: { completion: jest.fn() },
        provider: { id: 'provider-1' },
        model: { id: 'kg-model-id', externalId: 'ext-kg' },
      };
      jest.spyOn(factory, 'buildSource').mockResolvedValue(mockBuildResult as any);

      await factory.buildKnowledgeGraphSource();

      expect(factory.buildSource).toHaveBeenCalledWith('kg-model-id', undefined);
    });

    it('should thread request-timeout opts through to buildSource (graph-build callers)', async () => {
      mockGetSystemConfig.mockResolvedValue({
        knowledgeGraphAiProviderModelId: 'kg-model-id',
        systemAiProviderModelId: 'system-model-id',
      } as any);

      const mockBuildResult = {
        source: { completion: jest.fn() },
        provider: { id: 'provider-1' },
        model: { id: 'kg-model-id', externalId: 'ext-kg' },
      };
      jest.spyOn(factory, 'buildSource').mockResolvedValue(mockBuildResult as any);

      await factory.buildKnowledgeGraphSource({ requestTimeoutMs: 120_000 });

      expect(factory.buildSource).toHaveBeenCalledWith('kg-model-id', { requestTimeoutMs: 120_000 });
    });

    it('passes attribution through to the usage tracker for knowledge graph', async () => {
      mockGetSystemConfig.mockResolvedValue({
        knowledgeGraphAiProviderModelId: 'kg-model-id',
        systemAiProviderModelId: 'system-model-id',
      } as any);

      const mockBuildResult = {
        source: { completion: jest.fn() },
        provider: { id: 'provider-1' },
        model: { id: 'kg-model-id', externalId: 'ext-kg' },
      };
      jest.spyOn(factory, 'buildSource').mockResolvedValue(mockBuildResult as any);

      const attribution: UsageAttribution = { chatMessageId: 'msg-1', stepLabel: 'query routing' };

      await factory.buildKnowledgeGraphSource({ attribution });

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'kg-model-id',
        false,
        false,
        true,
        attribution,
        false,
        undefined,
      );
    });

    it('should throw when knowledge graph model is null even if system model exists', async () => {
      mockGetSystemConfig.mockResolvedValue({
        knowledgeGraphAiProviderModelId: null,
        systemAiProviderModelId: 'system-model-id',
      } as any);

      await expect(factory.buildKnowledgeGraphSource()).rejects.toThrow(
        'No AI provider model configured for knowledge graph operations',
      );
    });

    it('should throw when both model IDs are null', async () => {
      mockGetSystemConfig.mockResolvedValue({
        knowledgeGraphAiProviderModelId: null,
        systemAiProviderModelId: null,
      } as any);

      await expect(factory.buildKnowledgeGraphSource()).rejects.toThrow(
        'No AI provider model configured for knowledge graph operations',
      );
    });
  });

  describe('buildEmbeddingSource', () => {
    const mockGetEmbeddingModel = getEmbeddingModel as jest.MockedFunction<typeof getEmbeddingModel>;

    const mockEmbeddingModel = {
      id: 'embedding-model-id',
      aiProviderId: 'provider-1',
      name: 'Titan Text Embeddings V1',
      externalId: 'amazon.titan-embed-text-v1',
      costPerInputToken: 0.0000001,
      costPerOutputToken: 0,
      embeddingsOnly: true,
    };

    const mockBuildResult = {
      source: { createEmbeddings: jest.fn() },
      provider: { id: 'provider-1' },
      model: { id: 'embedding-model-id', externalId: 'amazon.titan-embed-text-v1' },
    };

    let factory: AIFactory;

    beforeEach(() => {
      jest.clearAllMocks();
      factory = new AIFactory(mockAIFactoryConfig);
      jest.spyOn(factory, 'buildSource').mockResolvedValue(mockBuildResult as any);
    });

    it('should resolve the designated embedding model for the factory user', async () => {
      mockGetEmbeddingModel.mockResolvedValue(mockEmbeddingModel);

      await factory.buildEmbeddingSource();

      expect(mockGetEmbeddingModel).toHaveBeenCalledWith('test-user-id');
      expect(factory.buildSource).toHaveBeenCalledWith('embedding-model-id', undefined);
    });

    it('should use a caller-supplied model id without a second lookup', async () => {
      await factory.buildEmbeddingSource('pre-resolved-model-id');

      expect(mockGetEmbeddingModel).not.toHaveBeenCalled();
      expect(factory.buildSource).toHaveBeenCalledWith('pre-resolved-model-id', undefined);
    });

    it('should flag embedding spend on the usage tracker', async () => {
      mockGetEmbeddingModel.mockResolvedValue(mockEmbeddingModel);

      await factory.buildEmbeddingSource();

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'embedding-model-id',
        false,
        false,
        false,
        {},
        true,
        undefined,
      );
    });

    it('should thread request-timeout opts through to buildSource', async () => {
      mockGetEmbeddingModel.mockResolvedValue(mockEmbeddingModel);

      await factory.buildEmbeddingSource(undefined, { requestTimeoutMs: 120_000 });

      expect(factory.buildSource).toHaveBeenCalledWith('embedding-model-id', {
        requestTimeoutMs: 120_000,
      });
    });

    it('should throw when no embedding model is designated', async () => {
      mockGetEmbeddingModel.mockResolvedValue(null);

      await expect(factory.buildEmbeddingSource()).rejects.toThrow(
        'No embedding model is configured. Ask an administrator to designate a model as embeddings only on an AI provider you have access to.',
      );

      expect(factory.buildSource).not.toHaveBeenCalled();
    });

    it('passes attribution through to the usage tracker for embeddings', async () => {
      mockGetEmbeddingModel.mockResolvedValue(mockEmbeddingModel);
      const attribution: UsageAttribution = { documentId: 'doc-1', stepLabel: 'ingestion' };

      await factory.buildEmbeddingSource('embedding-model-id', { attribution });

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'embedding-model-id',
        false,
        false,
        false,
        attribution,
        true,
        undefined,
      );
    });

    it('defaults embedding attribution to empty when none is given', async () => {
      mockGetEmbeddingModel.mockResolvedValue(mockEmbeddingModel);

      await factory.buildEmbeddingSource('embedding-model-id');

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'embedding-model-id',
        false,
        false,
        false,
        {},
        true,
        undefined,
      );
    });
  });

  describe('buildUserSource', () => {
    const mockBuildResult = {
      source: { completion: jest.fn() },
      provider: { id: 'provider-1' },
      model: { id: 'model-1', externalId: 'ext-1' },
    };

    let factory: AIFactory;

    beforeEach(() => {
      jest.clearAllMocks();
      factory = new AIFactory(mockAIFactoryConfig);
      jest.spyOn(factory, 'buildSource').mockResolvedValue(mockBuildResult as any);
    });

    it('should pass usage attribution to the usage tracker', async () => {
      await factory.buildUserSource('model-1', {
        attribution: { chatMessageId: 'message-1', stepLabel: 'response' },
      });

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'model-1',
        false,
        false,
        false,
        { chatMessageId: 'message-1', stepLabel: 'response' },
        false,
        undefined,
      );
    });

    it('should pass the factory\'s configured user group to the usage tracker', async () => {
      const groupScopedFactory = new AIFactory({ ...mockAIFactoryConfig, userGroupId: 'group-1' });
      jest.spyOn(groupScopedFactory, 'buildSource').mockResolvedValue(mockBuildResult as any);

      await groupScopedFactory.buildUserSource('model-1');

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'model-1',
        false,
        false,
        false,
        {},
        false,
        'group-1',
      );
    });

    it('should pass an empty attribution when none is given', async () => {
      await factory.buildUserSource('model-1');

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'model-1',
        false,
        false,
        false,
        {},
        false,
        undefined,
      );
    });

    it('should flag agent calls on the usage tracker', async () => {
      await factory.buildUserSource('model-1', { agent: true });

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'model-1',
        false,
        true,
        false,
        {},
        false,
        undefined,
      );
    });

    it('should pass audit context to the audited source', async () => {
      await factory.buildUserSource('model-1', {
        auditContext: { referer: '/api/internal/inference-with-tools' },
      });

      // Asserted positionally rather than with toHaveBeenCalledWith: the third
      // argument is the Prisma client, which jest cannot serialize.
      const auditArgs = (AuditedSource as jest.Mock).mock.calls[0];
      expect(auditArgs[0]).toBe(mockBuildResult.source);
      expect(auditArgs[1]).toBe('test-user-id');
      expect(auditArgs[3]).toEqual({ referer: '/api/internal/inference-with-tools' });
    });

    // The Agent SDK proxy tracks with both the agent flag and attribution, so the
    // combination needs to reach the tracker intact.
    it('should pass the agent flag and attribution together', async () => {
      await factory.buildUserSource('model-1', {
        agent: true,
        attribution: { chatMessageId: 'message-1', stepLabel: 'skill run' },
      });

      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'model-1',
        false,
        true,
        false,
        { chatMessageId: 'message-1', stepLabel: 'skill run' },
        false,
        undefined,
      );
    });
  });

  describe('wrapUserSource', () => {
    // Callers that cache the unwrapped provider re-wrap per request, so the
    // wrappers must be constructed fresh with that request's attribution.
    let factory: AIFactory;

    beforeEach(() => {
      jest.clearAllMocks();
      factory = new AIFactory(mockAIFactoryConfig);
    });

    it('should wrap a pre-built source without rebuilding it', async () => {
      const base = {
        source: { completion: jest.fn() },
        provider: { id: 'provider-1' },
        model: { id: 'model-1', externalId: 'ext-1' },
      };
      const buildSourceSpy = jest.spyOn(factory, 'buildSource');

      const result = await factory.wrapUserSource(base as any, 'model-1', {
        attribution: { workflowExecutionId: 'exec-1', primitiveId: 'prompt-1' },
      });

      expect(buildSourceSpy).not.toHaveBeenCalled();
      expect(result.provider).toBe(base.provider);
      expect(result.model).toBe(base.model);
      expect(AiProviderUsageTracker).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'model-1',
        false,
        false,
        false,
        { workflowExecutionId: 'exec-1', primitiveId: 'prompt-1' },
        false,
        undefined,
      );
    });
  });
});
