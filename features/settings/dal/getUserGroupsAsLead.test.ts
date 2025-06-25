import getUserGroupsAsLead from './getUserGroupsAsLead';
import db from '@/server/db';
import logger from '@/server/logger';
import { UserGroup, UserGroupRole } from '@/features/shared/types/user-group';

jest.mock('@/server/db', () => ({
  userGroup: {
    findMany: jest.fn(),
  },
}));

describe('getUserGroupsAsLead DAL', () => {

  const mockUserId = 'b5df35d9-c8a9-4b8d-b904-87e197f4b1ef';

  const mockUserGroupsWhereLead = [
    {
      id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
      label: 'User Group 1',
      createdAt: new Date('2024-04-04T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
      _count: { userGroupMemberships: 1 },
    },
    {
      id: 'd8283f19-fc06-40d2-ab82-52f7f02f2026',
      label: 'User Group 2',
      createdAt: new Date('2024-04-04T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
      _count: { userGroupMemberships: 2 },
    },
  ];

  const mockError = new Error('Error getting user groups as lead');
  const mockLoggerMessage = 'Error getting user groups as lead';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all user groups where the user is a Lead', async () => {
    (db.userGroup.findMany as jest.Mock).mockResolvedValue(mockUserGroupsWhereLead);

    const response = await getUserGroupsAsLead(mockUserId);
    expect(response).toEqual(mockUserGroupsWhereLead.map(
      (userGroup): UserGroup => ({
        id: userGroup.id,
        label: userGroup.label,
        createdAt: userGroup.createdAt,
        updatedAt: userGroup.updatedAt,
        memberCount: userGroup._count.userGroupMemberships,
      })
    ));

    expect(db.userGroup.findMany).toHaveBeenCalledWith({
      where: {
        userGroupMemberships: {
          some: {
            userId: mockUserId,
            role: UserGroupRole.Lead,
          },
        },
      },
      include: {
        _count: {
          select: {
            userGroupMemberships: true,
          },
        },
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns an empty array if user is not a Lead for any user groups', async () => {
    (db.userGroup.findMany as jest.Mock).mockResolvedValue([]);

    const response = await getUserGroupsAsLead(mockUserId);
    expect(response).toEqual([]);

    expect(db.userGroup.findMany).toHaveBeenCalled();

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the findMany operation fails', async () => {
    const rejectedError = new Error('Error during the findMany operation.');
    (db.userGroup.findMany as jest.Mock).mockRejectedValue(rejectedError);

    await expect(getUserGroupsAsLead(mockUserId)).rejects.toThrow(mockError);

    expect(db.userGroup.findMany).toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(mockLoggerMessage, rejectedError);
  });

});
