import db from '@/server/db';
import logger from '@/server/logger';
import updateAiProviderModel from './updateAiProviderModel';

jest.mock('@/server/db', () => ({
  model: {
    update: jest.fn(),
  },
}));

describe('updateAiProviderModel', () => {
  const validInput = {
    id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
    name: 'Updated AI Model',
    externalId: 'external-id',
    costPerInputToken: 0.01,
    costPerOutputToken: 0.02,
  };

  const dbResultMock = {
    id: validInput.id,
    name: validInput.name,
    externalId: validInput.externalId,
    costPerInputToken: validInput.costPerInputToken,
    costPerOutputToken: validInput.costPerOutputToken,
    embeddingsOnly: false,
    aiProviderId: '5f945e6e-3f95-40f0-aec7-87c966956fe4',
    aiProvider: { label: 'Existing AI provider label', aiProviderTypeId: 1 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully updates an AI provider model', async () => {
    (db.model.update as jest.Mock).mockResolvedValue(dbResultMock);

    const result = await updateAiProviderModel(validInput);

    expect(result).toEqual({
      id: dbResultMock.id,
      name: dbResultMock.name,
      externalId: dbResultMock.externalId,
      costPerInputToken: dbResultMock.costPerInputToken,
      costPerOutputToken: dbResultMock.costPerOutputToken,
      embeddingsOnly: false,
      aiProviderId: dbResultMock.aiProviderId,
      providerLabel: dbResultMock.aiProvider.label,
      aiProviderTypeId: dbResultMock.aiProvider.aiProviderTypeId,
    });

    expect(db.model.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validInput.id, deletedAt: null },
        data: {
          name: validInput.name,
          externalId: validInput.externalId,
          costPerInputToken: validInput.costPerInputToken,
          costPerOutputToken: validInput.costPerOutputToken,
        },
      }),
    );
  });

  // The designation is set when the model is added, where addAiProviderModel
  // enforces one per provider. Writing it from here would let an ordinary edit
  // clear it silently.
  it('never writes the embeddings-only flag', async () => {
    (db.model.update as jest.Mock).mockResolvedValue(dbResultMock);

    await updateAiProviderModel(validInput);

    expect(db.model.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ embeddingsOnly: expect.anything() }),
      }),
    );
  });

  it('returns the existing designation untouched', async () => {
    (db.model.update as jest.Mock).mockResolvedValue({
      ...dbResultMock,
      embeddingsOnly: true,
    });

    const result = await updateAiProviderModel(validInput);

    expect(result.embeddingsOnly).toBe(true);
  });

  it('handles errors when updating an AI provider model fails', async () => {
    const error = new Error('DB error');
    (db.model.update as jest.Mock).mockRejectedValue(error);

    await expect(updateAiProviderModel(validInput)).rejects.toThrow(
      'Error updating AI provider model',
    );

    expect(logger.error).toHaveBeenCalledWith('Error updating AI provider model', error);
  });
});
