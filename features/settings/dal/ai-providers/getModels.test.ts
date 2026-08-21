import { getModels } from './getModels';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    model: {
      findMany: jest.fn(),
    },
  };
});

describe('getModels', () => {
  const mockedResolvedValue = [
    {
      id: 'model1',
      aiProviderId: 'provider1',
      name: 'Model 1',
      aiProvider: {
        label: 'Provider 1',
        aiProviderTypeId: 'type1',
      },
      externalId: 'ext1',
      costPerInputToken: 0.001,
      costPerOutputToken: 0.002,
    },
    {
      id: 'model2',
      aiProviderId: 'provider2',
      name: 'Model 2',
      aiProvider: {
        label: 'Provider 2',
        aiProviderTypeId: 'type2',
      },
      externalId: 'ext2',
      costPerInputToken: 0.001,
      costPerOutputToken: 0.002,
    },
  ];

  const mockRejectedValue = new Error('Unable to fetch models at this time. Please try again later');

  beforeEach(() => {
    jest.clearAllMocks();
    (db.model.findMany as jest.Mock).mockResolvedValue(mockedResolvedValue);
  });

  it('returns models from the database', async () => {
    const models = await getModels();

    expect(db.model.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
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

    expect(models).toEqual(mockedResolvedValue.map((model) => ({
      id: model.id,
      aiProviderId: model.aiProviderId,
      providerLabel: model.aiProvider.label,
      aiProviderTypeId: model.aiProvider.aiProviderTypeId,
      name: model.name,
      externalId: model.externalId,
      costPerInputToken: model.costPerInputToken,
      costPerOutputToken: model.costPerOutputToken,
    })));
  });

  it('throws an error if the DB query fails', async () => {
    (db.model.findMany as jest.Mock).mockRejectedValue(mockRejectedValue);

    await expect(getModels()).rejects.toThrow(new Error('Error fetching AI provider models'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching AI provider models', mockRejectedValue
    );
  });

  it('returns an empty array if no models are found', async () => {
    (db.model.findMany as jest.Mock).mockResolvedValue([]);
  });
});
