import getAvailableModels from './getAvailableModels';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    model: {
      findMany: jest.fn(),
    },
  };
});
describe('getAvailableModelsDal', () => {
  const userId = 'f6201669-0bef-4411-b264-cd39cfbc62df';

  const mockedResolvedValue = [
    {
      id: 'test-model-1',
      aiProviderId: 'test-provider-1',
      name: 'GPT-4',
      externalId: 'gpt-4',
      costPerInputToken: 0.01,
      costPerOutputToken: 0.02,
      aiProvider: {
        label: 'OpenAI',
        aiProviderTypeId: 1,
      },
    },
  ];
  const mockRejectedValue = new Error('Unable to fetch models at this time. Please try again later');

  beforeEach(() => {
    jest.clearAllMocks();

    (db.model.findMany as jest.Mock).mockResolvedValue(mockedResolvedValue);
  });

  it('returns models based on user groups', async () => {
   
    const result = await getAvailableModels(userId);

    expect(db.model.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        embeddingsOnly: false,
        aiProvider: {
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
      include: {
        aiProvider: {
          select: {
            label: true,
            aiProviderTypeId: true,
          },
        },
      },
    });

    expect(result).toEqual([
      {
        id: 'test-model-1',
        aiProviderId: 'test-provider-1',
        name: 'GPT-4',
        providerLabel: 'OpenAI',
        aiProviderTypeId: 1,
        externalId: 'gpt-4',
        costPerInputToken: 0.01,
        costPerOutputToken: 0.02,
      },
    ]);
  });

  it('throws an error if the DB query fails', async () => {
    (db.model.findMany as jest.Mock).mockRejectedValue(mockRejectedValue);

    await expect(getAvailableModels(userId)).rejects.toThrow(new Error('Error fetching available models'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching available models', mockRejectedValue
    );
  });
});
