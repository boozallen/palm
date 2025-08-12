import getAvailableModels from './getAvailableModels';
import db from '@/server/db';
import { AvailableModel } from '../types/model';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    model: {
      findMany: jest.fn(),
    },
  };
});
describe('getAvailableModelsDal', () => {
  const userId = 'f6201669-0bef-4411-b264-cd39cfbc62df';

  const mockedResolvedValue: AvailableModel[] = [];
  const mockRejectedValue = new Error('Unable to fetch models at this time. Please try again later');

  beforeEach(() => {
    jest.clearAllMocks();

    (db.model.findMany as jest.Mock).mockResolvedValue(mockedResolvedValue);
  });

  it('returns models based on user groups', async () => {
   
    await getAvailableModels(userId);

    expect(db.model.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        aiProvider: {
          userGroups: {
            some: {
              userGroupMemberships: {
                some: {
                  userId,
                },
              },
            },
          },
        },
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

  it('throws an error if the DB query fails', async () => {
    (db.model.findMany as jest.Mock).mockRejectedValue(mockRejectedValue);

    await expect(getAvailableModels(userId)).rejects.toThrow(new Error('Error fetching available models'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching available models', mockRejectedValue
    );
  });
});
