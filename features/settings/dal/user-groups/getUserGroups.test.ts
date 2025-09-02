import db from '@/server/db';
import logger from '@/server/logger';
import getUserGroups from '@/features/settings/dal/user-groups/getUserGroups';

jest.mock('@/server/db', () => ({
  userGroup: {
    findMany: jest.fn(),
  },
}));

describe('getUserGroups', () => {
  const mockReturnedValue = [
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      label: 'User Group 1',
      createdAt: '2021-09-01T00:00:00.000Z',
      updatedAt: '2021-09-01T00:00:00.000Z',
      _count: { userGroupMemberships: 5 },
    },
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc157',
      label: 'User Group 2',
      createdAt: '2021-09-01T00:00:00.000Z',
      updatedAt: '2021-09-01T00:00:00.000Z',
      _count: { userGroupMemberships: 10 },
    },
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc158',
      label: 'User Group 3',
      createdAt: '2021-09-01T00:00:00.000Z',
      updatedAt: '2021-09-01T00:00:00.000Z',
      _count: { userGroupMemberships: 15 },
    },
  ];

  const mockError = new Error('Error getting user groups');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all user group records found in the DB', async () => {
    (db.userGroup.findMany as jest.Mock).mockResolvedValue(mockReturnedValue);

    const expectedResult = mockReturnedValue.map(item => ({
      id: item.id,
      label: item.label,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      memberCount: item._count?.userGroupMemberships,
    }));

    await expect(getUserGroups()).resolves.toEqual(expectedResult);
    expect(db.userGroup.findMany).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error when findMany query fails', async () => {
    (db.userGroup.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getUserGroups()).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith('Error getting user groups', mockError);
  });
});
