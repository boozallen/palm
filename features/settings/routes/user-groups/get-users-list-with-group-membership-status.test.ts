import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import getUsers from '@/features/settings/dal/shared/getUsers';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import settingsRouter from '@/features/settings/routes';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import getUserGroupMemberships from '@/features/settings/dal/user-groups/getUserGroupMemberships';

jest.mock('@/features/settings/dal/shared/getUsers');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMemberships');

describe('getUsersListWithGroupMembershipStatus', () => {
  const ctx = {
    user: {
      role: UserRole.Admin,
    },
  } as unknown as ContextType;

  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
  const mockUserGroupId = '6b54ffcd-c884-45c9-aa6e-57347f4cc159';

  const mockResults = [
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      name: 'Test Name',
      email: 'name_test@domain.com',
    },
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc157',
      name: 'Test Name 2',
      email: 'name2_test@domain.com',
    },
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc158',
      name: 'Test Name3',
      email: 'name3_test@domain.com',
    },
  ];

  const mockUserGroupMemberships = [
    {
      userId: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
    },

    {
      userId: '6b54ffcd-c884-45c9-aa6e-57347f4cc157',
    },
  ];
  const mockUserGroupMemberIds = mockUserGroupMemberships.map(
    (membership) => membership.userId
  );

  const mockUserGroupMembershipLead = {
    userGroupId: mockUserGroupId,
    userId: mockUserId,
    role: UserGroupRole.Lead,
  };

  const mockUserGroupMembershipUser = {
    userGroupId: mockUserGroupId,
    userId: mockUserId,
    role: UserGroupRole.User,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getUsers as jest.Mock).mockResolvedValue(mockResults);
  });

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  it('should get all users if user is an admin', async () => {
    ctx.userRole = UserRole.Admin;

    (getUserGroupMemberships as jest.Mock).mockResolvedValue(
      mockUserGroupMemberships
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUsersListWithGroupMembershipStatus({
        userGroupId: mockUserGroupId,
        searchQuery: '',
      })
    ).resolves.toEqual({
      usersGroupMembershipStatus: mockResults.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        isMember: mockUserGroupMemberIds.includes(user.id),
      })),
    });
    expect(getUsers).toHaveBeenCalled();
  });

  it('should call getUsers endpoint if user is lead', async () => {
    ctx.userRole = UserRole.User;

    (getUserGroupMemberships as jest.Mock).mockResolvedValue(
      mockUserGroupMemberships
    );

    const caller = settingsRouter.createCaller(ctx);
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipLead
    );

    await expect(
      caller.getUsersListWithGroupMembershipStatus({
        userGroupId: mockUserGroupId,
        searchQuery: '',
      })
    ).resolves.toEqual({
      usersGroupMembershipStatus: mockResults.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        isMember: mockUserGroupMemberIds.includes(user.id),
      })),
    });
    expect(getUsers).toHaveBeenCalled();
  });

  it('should throw error if user is not an Admin and not a lead when calling getUsers endpoint', async () => {
    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipUser
    );
    await expect(
      caller.getUsersListWithGroupMembershipStatus({
        userGroupId: mockUserGroupId,
        searchQuery: '',
      })
    ).rejects.toThrow(mockError);
    expect(getUsers).not.toHaveBeenCalled();
  });
});
