import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';
import { tryGetRedisClient } from '@/server/storage/redisConnection';
import { RequirementNames } from '@/features/settings/types/system-requirements';

jest.mock('@/features/shared/dal/getEmbeddingModel');
jest.mock('@/server/storage/redisConnection');

describe('getCertaRequirements route', () => {
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
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return configured: true when all systems are available', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

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

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getCertaRequirements()).rejects.toThrow();

    expect(getEmbeddingModel).not.toHaveBeenCalled();
    expect(tryGetRedisClient).not.toHaveBeenCalled();
  });

  it('should return configured: false with AWS Bedrock requirement available: false when no embedding model is registered', async () => {
    (getEmbeddingModel as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

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

  it('should return configured: false with Redis requirement available: false when Redis is unavailable', async () => {
    (tryGetRedisClient as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

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

  it('should return configured: false with multiple unavailable requirements when more than one requirement is unavailable', async () => {
    (getEmbeddingModel as jest.Mock).mockResolvedValue(null);
    (tryGetRedisClient as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaRequirements();

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
