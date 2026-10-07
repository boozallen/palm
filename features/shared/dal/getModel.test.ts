import db from '@/server/db';
import logger from '@/server/logger';
import getModel from './getModel';

jest.mock('@/server/db', () => {
  return {
    model: {
      findUnique: jest.fn(),
    },
  };
});

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('getModel', () => {
  const mockModelId = 'eb65a224-56aa-49bb-a681-dcc484ec422e';
  const mockModel = {
    id: mockModelId,
    aiProviderId: '5f945e6e-3f95-40f0-aec7-87c966956fe4',
    name: 'gpt-4',
    externalId: 'gpt-4',
    costPerInputToken: 0.03,
    costPerOutputToken: 0.06,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return model when found', async () => {
    (db.model.findUnique as jest.Mock).mockResolvedValue(mockModel);

    const result = await getModel(mockModelId);

    expect(result).toEqual({
      id: mockModelId,
      aiProviderId: '5f945e6e-3f95-40f0-aec7-87c966956fe4',
      name: 'gpt-4',
      externalId: 'gpt-4',
      costPerInputToken: 0.03,
      costPerOutputToken: 0.06,
    });

    expect(db.model.findUnique).toHaveBeenCalledWith({
      where: { id: mockModelId, deletedAt: null },
    });
  });

  it('should throw error when model not found', async () => {
    (db.model.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getModel(mockModelId)).rejects.toThrow('Model not found');

    expect(logger.warn).toHaveBeenCalledWith('Model not found');
    expect(db.model.findUnique).toHaveBeenCalledWith({
      where: { id: mockModelId, deletedAt: null },
    });
  });

  it('should handle database errors', async () => {
    const mockError = new Error('Database connection failed');
    (db.model.findUnique as jest.Mock).mockRejectedValue(mockError);

    await expect(getModel(mockModelId)).rejects.toThrow('Error fetching model');

    expect(logger.error).toHaveBeenCalledWith('Error fetching model', mockError);
  });
});