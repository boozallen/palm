import db from '@/server/db';
import logger from '@/server/logger';
import getEmbeddingModel from './getEmbeddingModel';

jest.mock('@/server/db', () => {
  return {
    model: {
      findFirst: jest.fn(),
    },
  };
});

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('getEmbeddingModel', () => {
  const mockUserId = 'ac0a7dd7-6a90-4a4a-9f8d-1d69f5e6b0a1';

  const mockModel = {
    id: 'eb65a224-56aa-49bb-a681-dcc484ec422e',
    aiProviderId: '5f945e6e-3f95-40f0-aec7-87c966956fe4',
    name: 'Titan Text Embeddings V1',
    externalId: 'amazon.titan-embed-text-v1',
    costPerInputToken: 0.0000001,
    costPerOutputToken: 0,
    embeddingsOnly: true,
    deletedAt: null,
  };

  const expectedQuery = {
    where: {
      deletedAt: null,
      embeddingsOnly: true,
      aiProvider: {
        deletedAt: null,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: {
                userId: mockUserId,
              },
            },
          },
        },
      },
    },
    orderBy: [{ aiProvider: { createdAt: 'asc' } }, { id: 'asc' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the embedding model when found', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(mockModel);

    const result = await getEmbeddingModel(mockUserId);

    expect(result).toEqual({
      id: mockModel.id,
      aiProviderId: mockModel.aiProviderId,
      name: mockModel.name,
      externalId: mockModel.externalId,
      costPerInputToken: mockModel.costPerInputToken,
      costPerOutputToken: mockModel.costPerOutputToken,
      embeddingsOnly: true,
    });
  });

  it('should look up the designated embedding model within the user groups', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(mockModel);

    await getEmbeddingModel(mockUserId);

    expect(db.model.findFirst).toHaveBeenCalledWith(expectedQuery);
  });

  it('should return null and log when the user has no embedding model available', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getEmbeddingModel(mockUserId);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'No embedding model is available to this user',
    );
  });

  it('should return null and log when the database query fails', async () => {
    const mockError = new Error('Database connection failed');
    (db.model.findFirst as jest.Mock).mockRejectedValue(mockError);

    const result = await getEmbeddingModel(mockUserId);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Error fetching embedding model', mockError);
  });
});
