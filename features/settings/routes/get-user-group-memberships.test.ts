import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import getUserGroupMemberships from '@/features/settings/dal/getUserGroupMemberships';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserGroupRole } from '@/features/shared/types/user-group';

jest.mock('@/features/settings/dal/getUserGroupMemberships');
jest.mock('@/features/settings/dal/getUserGroupMembership');

describe('getUserGroupMemberships Route', () => {
  const ctx = {
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    userRole: UserRole.User,
  } as ContextType;

  const mockUserGroupMemberships = {
    userGroupMemberships: [
      {
        userGroupId: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
        userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
        name: 'User 1',
        role: UserGroupRole.Lead,
        email: 'User1@gmail.com',
      },
      {
        userGroupId: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
        userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
        name: 'User 2',
        role: UserGroupRole.User,
        email: 'User2@gmail.com',
      },
    ],
  };

  const mockUserGroupMembershipUser = {
    userGroupId: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    role: UserGroupRole.User,
  };

  const mockUserGroupMembershipLead = {
    userGroupId: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    role: UserGroupRole.Lead,
  };

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  beforeEach(() => {
    jest.clearAllMocks();

    (getUserGroupMemberships as jest.Mock).mockResolvedValue(
      mockUserGroupMemberships.userGroupMemberships
    );
  });

  it('should get user group memberships if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupMemberships({
        id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      })
    ).resolves.toEqual(mockUserGroupMemberships);
    expect(getUserGroupMemberships).toHaveBeenCalledWith(
      '6b54ffcd-c884-45c9-aa6e-57347f4cc156'
    );
  });
  it('should get user group memberships if user is Lead', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipLead
    );
    await expect(
      caller.getUserGroupMemberships({
        id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      })
    ).resolves.toEqual(mockUserGroupMemberships);
    expect(getUserGroupMemberships).toHaveBeenCalledWith(
      '6b54ffcd-c884-45c9-aa6e-57347f4cc156'
    );
  });

  it('should throw error if user is not an Admin and not a Lead', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    (getUserGroupMembership as jest.Mock).mockResolvedValue(
      mockUserGroupMembershipUser
    );
    await expect(
      caller.getUserGroupMemberships({
        id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      })
    ).rejects.toThrowError(mockError);
    expect(getUserGroupMemberships).not.toHaveBeenCalled();
  });
});
