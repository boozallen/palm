import db from '@/server/db';
import getFirstAvailableOpenAiModel from './getFirstAvailableOpenAiModel';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    model: {
      findFirst: jest.fn(),
    },
  };
});

describe('getFirstAvailableOpenAiModel', () => {
  const mockModel = {
    id: '5b6b44da-0ccf-41f6-9264-e69829320df1',
    aiProviderId: '4f8b6570-2ec8-4ff5-9681-0b3d2f1785f5',
    name: 'Test Model',
    externalId: 'test-model',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.model.findFirst as jest.Mock).mockReturnValue(mockModel);
  });

  it('calls findFirst with the correct parameters', async () => {
    await expect(getFirstAvailableOpenAiModel()).resolves.toEqual(mockModel);

    expect(db.model.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        aiProvider: {
          aiProviderTypeId: 1,
          deletedAt: null,
        },
      },
    });
  });

  it('returns null if no model is found', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getFirstAvailableOpenAiModel()).resolves.toBeNull();
  });

  it('returns null and logs an error if the database query fails', async () => {
    const testError = new Error('Test error');
    (db.model.findFirst as jest.Mock).mockRejectedValue(testError);

    await expect(getFirstAvailableOpenAiModel()).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Error fetching OpenAI model', testError);
  });
});
