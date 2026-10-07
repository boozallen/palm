import db from '@/server/db';
import logger from '@/server/logger';
import getFirstAvailableModel from './getFirstAvailableModel';

jest.mock('@/server/db', () => ({
  model: {
    findFirst: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getFirstAvailableModel', () => {
  const mockModel = {
    id: 'model-123',
    aiProviderId: 'provider-123',
    name: 'Test Model',
    externalId: 'gpt-4',
    costPerInputToken: 0.01,
    costPerOutputToken: 0.03,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the first available model', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(mockModel);

    const result = await getFirstAvailableModel();

    expect(result).toEqual({
      id: mockModel.id,
      aiProviderId: mockModel.aiProviderId,
      name: mockModel.name,
      externalId: mockModel.externalId,
      costPerInputToken: mockModel.costPerInputToken,
      costPerOutputToken: mockModel.costPerOutputToken,
    });

    expect(db.model.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        embeddingsOnly: false,
        aiProvider: {
          deletedAt: null,
        },
      },
    });
  });

  it('returns null when no model is found', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getFirstAvailableModel();

    expect(result).toBeNull();
  });

  it('returns null and logs error on database error', async () => {
    const mockError = new Error('Database error');
    (db.model.findFirst as jest.Mock).mockRejectedValue(mockError);

    const result = await getFirstAvailableModel();

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching available model',
      mockError
    );
  });
});
