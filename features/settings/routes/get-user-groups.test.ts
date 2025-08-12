import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getUserGroups from '@/features/settings/dal/getUserGroups';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

jest.mock('@/features/settings/dal/getUserGroups');
jest.mock('@/features/shared/dal/getIsUserGroupLead');

describe('getUserGroupsRoute', () => {
  const ctx = {
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockUserGroups = {
    userGroups: [
      {
        id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
        label: 'User Group 1',
        createdAt: new Date('2021-09-01T00:00:00.000Z'),
        updatedAt: new Date('2021-09-01T00:00:00.000Z'),
        memberCount: 5,
      },
      {
        id: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
        label: 'User Group 2',
        createdAt: new Date('2021-09-01T00:00:00.000Z'),
        updatedAt: new Date('2021-09-01T00:00:00.000Z'),
        memberCount: 10,
      },
      {
        id: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
        label: 'User Group 3',
        createdAt: new Date('2021-09-01T00:00:00.000Z'),
        updatedAt: new Date('2021-09-01T00:00:00.000Z'),
        memberCount: 15,
      },
    ],
  };

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  beforeEach(() => {
    jest.clearAllMocks();

    (getUserGroups as jest.Mock).mockResolvedValue(mockUserGroups.userGroups);
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(false);
  });

  it('should get user groups if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroups()).resolves.toEqual({
      userGroups: mockUserGroups.userGroups.map((userGroup) => ({
        id: userGroup.id,
        label: userGroup.label,
        createdAt: userGroup.createdAt,
        updatedAt: userGroup.updatedAt,
        memberCount: userGroup.memberCount,
      })),
    });
    expect(getUserGroups).toHaveBeenCalled();
  });

  it('should throw error if user is not an Admin and not a group lead', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroups()).rejects.toThrow(mockError);
    expect(getUserGroups).not.toHaveBeenCalled();
    expect(getIsUserGroupLead).toHaveBeenCalledWith(ctx.userId);
  });
  it('should get user groups if user is not an Admin but is a group lead', async () => {
    ctx.userRole = UserRole.User;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(true);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getUserGroups()).resolves.toEqual({
      userGroups: mockUserGroups.userGroups.map((userGroup) => ({
        id: userGroup.id,
        label: userGroup.label,
        createdAt: userGroup.createdAt,
        updatedAt: userGroup.updatedAt,
        memberCount: userGroup.memberCount,
      })),
    });
    expect(getUserGroups).toHaveBeenCalled();
    expect(getIsUserGroupLead).toHaveBeenCalledWith(ctx.userId);
  });
});
