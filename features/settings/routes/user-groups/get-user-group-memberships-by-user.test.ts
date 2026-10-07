import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { ContextType } from '@/server/trpc-context';
import getUserGroupMembershipsByUser from '@/features/settings/dal/user-groups/getUserGroupMembershipsByUser';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import settingsRouter from '@/features/settings/routes';

jest.mock(
  '@/features/settings/dal/user-groups/getUserGroupMembershipsByUser'
);

describe('getUserGroupMembershipsByUser', () => {
  let ctx: ContextType;

  const mockAdminId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
  const mockUserId = '6b54ffcd-c884-45c9-aa6e-57347f4cc157';

  const mockMemberships = [
    {
      userGroupId: 'b1f9c2e4-0d7a-4a3b-9c8e-1a2b3c4d5e6f',
      role: UserGroupRole.Lead,
    },
    {
      userGroupId: 'c2f8b3d5-1e6b-4b2c-8d7f-2b3c4d5e6f70',
      role: UserGroupRole.User,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserGroupMembershipsByUser as jest.Mock).mockResolvedValue(
      mockMemberships
    );

    ctx = {
      userId: mockAdminId,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return the requested user\'s memberships if the caller is an admin', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupMembershipsByUser({ userId: mockUserId })
    ).resolves.toEqual({ memberships: mockMemberships });

    expect(getUserGroupMembershipsByUser).toHaveBeenCalledWith(mockUserId);
  });

  it('should throw an error if the caller is not an admin', async () => {
    ctx.userRole = UserRole.User;
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupMembershipsByUser({ userId: mockUserId })
    ).rejects.toThrow(
      Forbidden('You do not have permission to access this resource')
    );

    expect(getUserGroupMembershipsByUser).not.toHaveBeenCalled();
  });
});
