import db from '@/server/db';
import logger from '@/server/logger';
import { DuplicateEmbeddingsModelError } from '@/features/shared/errors/duplicateEmbeddingsModelError';
import addAiProviderModel from './addAiProviderModel';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockCreate = jest.fn();
const mockFindFirst = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    model: { create: mockCreate, findFirst: mockFindFirst },
  });
});

describe('addAiProviderModel', () => {
  const validInput = {
    name: 'New AI Model',
    externalId: 'external-id',
    aiProviderId: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
    aiProviderTypeId: 1,
    costPerInputToken: 0,
    costPerOutputToken: 0,
  };

  const dbResultMock = {
    id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
    name: 'New AI Model',
    externalId: 'external-id',
    aiProviderId: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    embeddingsOnly: false,
    aiProvider: { label: 'Existing AI provider label', aiProviderTypeId: 1 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
  });

  it('successfully adds an AI provider model', async () => {
    mockCreate.mockResolvedValue(dbResultMock);

    const result = await addAiProviderModel(validInput);

    expect(result).toEqual({
      id: dbResultMock.id,
      name: dbResultMock.name,
      externalId: dbResultMock.externalId,
      aiProviderId: dbResultMock.aiProviderId,
      costPerInputToken: dbResultMock.costPerInputToken,
      costPerOutputToken: dbResultMock.costPerOutputToken,
      embeddingsOnly: dbResultMock.embeddingsOnly,
      providerLabel: dbResultMock.aiProvider.label,
      aiProviderTypeId: dbResultMock.aiProvider.aiProviderTypeId,
    });
    expect(logger.debug).toHaveBeenCalledWith('db.model.create', {
      result: dbResultMock,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: validInput.name,
        externalId: validInput.externalId,
        aiProviderId: validInput.aiProviderId,
        costPerInputToken: validInput.costPerInputToken,
        costPerOutputToken: validInput.costPerOutputToken,
        embeddingsOnly: false,
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
  });

  // An omitted flag must mean "ordinary model" rather than undefined, so a model
  // added without the checkbox can never end up serving embeddings.
  it('defaults the embeddings-only flag to false when it is omitted', async () => {
    mockCreate.mockResolvedValue(dbResultMock);

    await addAiProviderModel(validInput);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ embeddingsOnly: false }),
      }),
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('adds a model designated embeddings only', async () => {
    mockCreate.mockResolvedValue({ ...dbResultMock, embeddingsOnly: true });

    const result = await addAiProviderModel({
      ...validInput,
      embeddingsOnly: true,
    });

    expect(result.embeddingsOnly).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ embeddingsOnly: true }),
      }),
    );
  });

  // getEmbeddingModel picks one row per provider, so a second designation would
  // silently never be used. The check shares the insert's transaction.
  it('refuses a second embeddings-only model on the same provider', async () => {
    mockFindFirst.mockResolvedValue({ name: 'Titan Text Embeddings V1' });

    // The typed error is what the route keys on to translate this into a CONFLICT
    // rather than a sanitized 500, so the type matters as much as the message.
    await expect(
      addAiProviderModel({ ...validInput, embeddingsOnly: true }),
    ).rejects.toThrow(DuplicateEmbeddingsModelError);

    await expect(
      addAiProviderModel({ ...validInput, embeddingsOnly: true }),
    ).rejects.toThrow(
      'This provider already uses "Titan Text Embeddings V1" for embeddings. Delete that model first.',
    );

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('scopes the uniqueness check to the provider and to live models', async () => {
    mockCreate.mockResolvedValue({ ...dbResultMock, embeddingsOnly: true });

    await addAiProviderModel({ ...validInput, embeddingsOnly: true });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        embeddingsOnly: true,
        aiProviderId: validInput.aiProviderId,
      },
      select: { name: true },
    });
  });

  it('allows an embeddings-only model when the provider has none', async () => {
    mockCreate.mockResolvedValue({ ...dbResultMock, embeddingsOnly: true });

    await expect(
      addAiProviderModel({ ...validInput, embeddingsOnly: true }),
    ).resolves.toEqual(expect.objectContaining({ embeddingsOnly: true }));
  });

  it('handles errors when adding an AI provider model fails', async () => {
    const error = new Error('DB error');

    mockCreate.mockRejectedValue(error);

    await expect(addAiProviderModel(validInput)).rejects.toThrow(
      'Error creating AI provider model',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error creating AI provider model',
      error,
    );
  });
});
