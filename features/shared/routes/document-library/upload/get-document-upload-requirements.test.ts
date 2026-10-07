import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import { RequirementNames } from '@/features/settings/types/system-requirements';

import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';
import { tryGetRedisClient } from '@/server/storage/redisConnection';

jest.mock('@/features/shared/dal/getEmbeddingModel');
jest.mock('@/server/storage/redisConnection');

describe('getDocumentUploadRequirements route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getEmbeddingModel as jest.Mock).mockResolvedValue({
      id: 'model-123',
      aiProviderId: 'provider-456',
      name: 'Titan Text Embeddings V1',
      externalId: 'amazon.titan-embed-text-v1',
      costPerInputToken: 0.0000001,
      costPerOutputToken: 0,
      embeddingsOnly: true,
    });

    (tryGetRedisClient as jest.Mock).mockResolvedValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    mockCtx = {
      logger,
    } as unknown as ContextType;
  });

  it('should return configured: true when the embedding model and Redis are available', async () => {
    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getDocumentUploadRequirements();

    expect(result).toEqual({
      configured: true,
      requirements: [
        {
          name: RequirementNames.BEDROCK_AI_PROVIDER,
          available: true,
        },
        {
          name: RequirementNames.REDIS_INSTANCE,
          available: true,
        },
      ],
    });

    expect(getEmbeddingModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should return configured: false when the embedding model is unavailable', async () => {
    (getEmbeddingModel as jest.Mock).mockResolvedValue(null);

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getDocumentUploadRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: RequirementNames.BEDROCK_AI_PROVIDER,
          available: false,
        },
        {
          name: RequirementNames.REDIS_INSTANCE,
          available: true,
        },
      ],
    });

    expect(getEmbeddingModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should return configured: false when Redis is unavailable', async () => {
    (tryGetRedisClient as jest.Mock).mockResolvedValue(null);

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getDocumentUploadRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: RequirementNames.BEDROCK_AI_PROVIDER,
          available: true,
        },
        {
          name: RequirementNames.REDIS_INSTANCE,
          available: false,
        },
      ],
    });

    expect(getEmbeddingModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should return configured: false when both the embedding model and Redis are unavailable', async () => {
    (getEmbeddingModel as jest.Mock).mockResolvedValue(null);
    (tryGetRedisClient as jest.Mock).mockResolvedValue(null);

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getDocumentUploadRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: RequirementNames.BEDROCK_AI_PROVIDER,
          available: false,
        },
        {
          name: RequirementNames.REDIS_INSTANCE,
          available: false,
        },
      ],
    });

    expect(getEmbeddingModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });
});
