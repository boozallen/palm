import getBedrockModelAccess from './getBedrockModelAccess';
import db from '@/server/db';
import logger from '@/server/logger';
import { AiProviderType } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  model: {
    findFirst: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getBedrockModelAccess', () => {
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when user has access to Bedrock models', async () => {
    const mockModel = {
      id: 'model-123',
      aiProviderId: 'provider-123',
      name: 'Claude 3.5 Sonnet',
      externalId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      costPerInputToken: 0.003,
      costPerOutputToken: 0.015,
    };

    (db.model.findFirst as jest.Mock).mockResolvedValue(mockModel);

    const result = await getBedrockModelAccess(userId);

    expect(result).toBe(true);
    expect(db.model.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        embeddingsOnly: false,
        aiProvider: {
          aiProviderTypeId: AiProviderType.Bedrock,
          deletedAt: null,
          userGroups: {
            some: {
              userGroupMemberships: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
    });
  });

  it('should return false when user has no access to Bedrock models', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getBedrockModelAccess(userId);

    expect(result).toBe(false);
  });

  it('should throw error when database query fails', async () => {
    const error = new Error('Database connection failed');
    (db.model.findFirst as jest.Mock).mockRejectedValue(error);

    await expect(getBedrockModelAccess(userId)).rejects.toThrow(
      'Error checking Bedrock model access'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error checking Bedrock model access', error
    );
  });
});