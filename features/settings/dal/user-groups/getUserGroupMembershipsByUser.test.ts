import getUserGroupMembershipsByUser from './getUserGroupMembershipsByUser';
import logger from '@/server/logger';
import { UserGroupRole } from '@/features/shared/types/user-group';

const findManyMock = jest.fn();

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findMany: jest.fn().mockImplementation((...args) => findManyMock(...args)),
  },
}));

describe('getUserGroupMembershipsByUser', () => {
  const userId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

  beforeEach(() => {
    jest.clearAllMocks();

    findManyMock.mockResolvedValue([]);
  });

  it('should return the user group id and role for each of the user\'s memberships', async () => {
    findManyMock.mockResolvedValue([
      {
        userGroupId: 'b1f9c2e4-0d7a-4a3b-9c8e-1a2b3c4d5e6f',
        role: UserGroupRole.Lead,
      },
      {
        userGroupId: 'c2f8b3d5-1e6b-4b2c-8d7f-2b3c4d5e6f70',
        role: UserGroupRole.User,
      },
    ]);

    const result = await getUserGroupMembershipsByUser(userId);

    expect(result).toEqual([
      {
        userGroupId: 'b1f9c2e4-0d7a-4a3b-9c8e-1a2b3c4d5e6f',
        role: UserGroupRole.Lead,
      },
      {
        userGroupId: 'c2f8b3d5-1e6b-4b2c-8d7f-2b3c4d5e6f70',
        role: UserGroupRole.User,
      },
    ]);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId },
      select: { userGroupId: true, role: true },
    });
  });

  it('should log the cause and throw a sanitized error when the query fails', async () => {
    const queryError = new Error('connection terminated unexpectedly');

    findManyMock.mockRejectedValue(queryError);

    await expect(getUserGroupMembershipsByUser(userId)).rejects.toThrow(
      'Error getting user group memberships by user'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting user group memberships by user',
      queryError
    );
  });
});
