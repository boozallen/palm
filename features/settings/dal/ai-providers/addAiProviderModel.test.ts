import db from '@/server/db';
import logger from '@/server/logger';
import addAiProviderModel from './addAiProviderModel';

jest.mock('@/server/db', () => ({
  model: {
    create: jest.fn(),
  },
}));

describe('addAiProviderModel', () => {
  const validInput = {
    name: 'New AI Model',
    externalId: 'external-id',
    aiProviderId: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
    costPerInputToken: 0,
    costPerOutputToken: 0,
  };

  const dbResultMock = {
    id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
    name: 'New AI Model',
    externalId: 'external-id',
    aiProviderId: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
    aiProvider: { label: 'Existing AI provider label' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully adds an AI provider model', async () => {
    (db.model.create as jest.Mock).mockResolvedValue(dbResultMock);

    const result = await addAiProviderModel(validInput);

    expect(result).toEqual({
      id: dbResultMock.id,
      name: dbResultMock.name,
      externalId: dbResultMock.externalId,
      aiProviderId: dbResultMock.aiProviderId,
      providerLabel: dbResultMock.aiProvider.label,
    });
    expect(logger.debug).toHaveBeenCalledWith('db.model.create', {
      result: dbResultMock,
    });
    expect(db.model.create).toHaveBeenCalledWith({
      data: {
        name: validInput.name,
        externalId: validInput.externalId,
        aiProviderId: validInput.aiProviderId,
        costPerInputToken: validInput.costPerInputToken,
        costPerOutputToken: validInput.costPerOutputToken,
      },
      include: {
        aiProvider: {
          select: {
            label: true,
          },
        },
      },
    });
  });

  it('handles errors when adding an AI provider model fails', async () => {
    const error = new Error('DB error');

    (db.model.create as jest.Mock).mockRejectedValue(error);

    await expect(addAiProviderModel(validInput)).rejects.toThrow(
      'Error creating AI provider model',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error creating AI provider model',
      error,
    );
  });
});
