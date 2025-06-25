import db from '@/server/db';
import getUserFirstAvailableOpenAiModel from './getUserFirstAvailableOpenAiModel';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    model: {
      findFirst: jest.fn(),
    },
  };
});

jest.mock('@/server/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('getUserFirstAvailableOpenAiModel', () => {
  const mockModel = {
    id: '5b6b44da-0ccf-41f6-9264-e69829320df1',
    aiProviderId: '4f8b6570-2ec8-4ff5-9681-0b3d2f1785f5',
    name: 'Test Model',
    externalId: 'test-model',
  };

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    (db.model.findFirst as jest.Mock).mockResolvedValue(mockModel);
  });

  it('calls findFirst with the correct parameters', async () => {
    await expect(getUserFirstAvailableOpenAiModel(mockUserId)).resolves.toEqual(mockModel);

    expect(db.model.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        aiProvider: {
          aiProviderTypeId: 1,
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
    });
  });

  it('throws an error if no model is found', async () => {
    (db.model.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getUserFirstAvailableOpenAiModel(mockUserId)).rejects.toThrow(
      'Error fetching OpenAI model'
    );
    expect(logger.warn).toHaveBeenCalledWith(`No available OpenAI model found for user ${mockUserId}`);
  });

  it('catches any error thrown by db', async () => {
    (db.model.findFirst as jest.Mock).mockRejectedValue(new Error('Test error'));

    await expect(getUserFirstAvailableOpenAiModel(mockUserId)).rejects.toThrow(
      'Error fetching OpenAI model'
    );
    expect(logger.error).toHaveBeenCalledWith(`Error fetching OpenAI model for user ${mockUserId}`, new Error('Test error'));
  });
});
