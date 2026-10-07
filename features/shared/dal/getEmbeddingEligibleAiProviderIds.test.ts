import getEmbeddingEligibleAiProviderIds from './getEmbeddingEligibleAiProviderIds';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    model: {
      findMany: jest.fn(),
    },
  };
});

describe('getEmbeddingEligibleAiProviderIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the distinct set of AI providers with an embeddings-only model', async () => {
    (db.model.findMany as jest.Mock).mockResolvedValue([
      { aiProviderId: 'provider-1' },
      { aiProviderId: 'provider-2' },
    ]);

    const result = await getEmbeddingEligibleAiProviderIds();

    expect(db.model.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        embeddingsOnly: true,
        aiProvider: { deletedAt: null },
      },
      select: { aiProviderId: true },
      distinct: ['aiProviderId'],
    });
    expect(result).toEqual(['provider-1', 'provider-2']);
  });

  it('throws an error if the DB query fails', async () => {
    const mockError = new Error('Database connection failed');
    (db.model.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getEmbeddingEligibleAiProviderIds()).rejects.toThrow(
      'Error fetching embedding-eligible AI providers',
    );
    expect(logger.error).toHaveBeenCalledWith('Error fetching embedding-eligible AI providers', mockError);
  });
});
