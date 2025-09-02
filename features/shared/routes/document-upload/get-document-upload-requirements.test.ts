import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import { RequirementNames } from '@/features/settings/types/system-requirements';

import getFirstAvailableBedrockModel from '@/features/settings/dal/ai-providers/getFirstAvailableBedrockModel';
import { tryGetRedisClient } from '@/server/storage/redisConnection';

jest.mock('@/features/settings/dal/ai-providers/getFirstAvailableBedrockModel');
jest.mock('@/server/storage/redisConnection');

describe('getDocumentUploadRequirements route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirstAvailableBedrockModel as jest.Mock).mockResolvedValue({
      id: 'model-123',
      aiProviderId: 'provider-456',
      name: 'Titan Embedding Model',
      externalId: 'amazon.titan-embed-text-v1',
      costPerInputToken: 0.0001,
      costPerOutputToken: 0.0001,
    });

    (tryGetRedisClient as jest.Mock).mockResolvedValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    });

    mockCtx = {
      logger,
    } as unknown as ContextType;
  });

  it('should return configured: true when Bedrock and Redis are available', async () => {
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

    expect(getFirstAvailableBedrockModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should return configured: false when Bedrock is unavailable', async () => {
    (getFirstAvailableBedrockModel as jest.Mock).mockResolvedValue(null);

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

    expect(getFirstAvailableBedrockModel).toHaveBeenCalled();
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

    expect(getFirstAvailableBedrockModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });

  it('should return configured: false when both Bedrock and Redis are unavailable', async () => {
    (getFirstAvailableBedrockModel as jest.Mock).mockResolvedValue(null);
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

    expect(getFirstAvailableBedrockModel).toHaveBeenCalled();
    expect(tryGetRedisClient).toHaveBeenCalled();
  });
});
