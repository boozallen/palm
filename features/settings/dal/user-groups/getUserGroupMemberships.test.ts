import getUserGroupMemberships from './getUserGroupMemberships';
import { UserGroupRole } from '@/features/shared/types/user-group';

const findManyMock = jest.fn();

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findMany: jest.fn().mockImplementation((...args) => findManyMock(...args)),
  },
}));

describe('getUserGroupMemberships', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    findManyMock.mockResolvedValue([]);
  });

  it('should return user group memberships successfully', async () => {
    const userGroupIdOne = 'test1-id';

    findManyMock.mockReturnValue([{
      userGroupId: userGroupIdOne,
      userId: 'user1',
      user: {
        name: 'User 1',
        email: 'user1@gmail.com',
        lastLoginAt: new Date(),
      },
      role: UserGroupRole.Lead,
    }, {
      userGroupId: userGroupIdOne,
      userId: 'user3',
      user: {
        name: 'User 3',
        email: 'user3@gmail.com',
        lastLoginAt: new Date(),
      },
      role: UserGroupRole.User,
    }]);

    const result = await getUserGroupMemberships(userGroupIdOne);

    expect(result).toEqual([{
      userGroupId: userGroupIdOne,
      userId: 'user1',
      name: 'User 1',
      role: UserGroupRole.Lead,
      email: 'user1@gmail.com',
      lastLoginAt: expect.any(Date),
    }, {
      userGroupId: userGroupIdOne,
      userId: 'user3',
      name: 'User 3',
      role: UserGroupRole.User,
      email: 'user3@gmail.com',
      lastLoginAt: expect.any(Date),
    }]);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userGroupId: userGroupIdOne },
      include: { user: true },
    });
  });
});
