import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import getUserGroupGitHubProviders from '@/features/settings/dal/user-groups/getUserGroupGitHubProviders';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

jest.mock('@/features/settings/dal/user-groups/getUserGroupGitHubProviders');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

describe('getUserGroupGitHubProviders route', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockProviders = [
    {
      id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
      label: 'My Provider',
      description: 'A test provider',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  const mockError = Forbidden('You do not have permission to access this resource');

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
    (getUserGroupGitHubProviders as jest.Mock).mockResolvedValue(mockProviders);
  });

  it('returns providers when the user is an admin', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupGitHubProviders({ id: mockUserGroupId }),
    ).resolves.toEqual({
      userGroupGitHubProviders: mockProviders.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(getUserGroupGitHubProviders).toHaveBeenCalledWith(mockUserGroupId);
  });

  it('returns providers when the user is a group Lead', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.Lead,
    });
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupGitHubProviders({ id: mockUserGroupId }),
    ).resolves.toEqual({
      userGroupGitHubProviders: mockProviders.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });

    expect(getUserGroupGitHubProviders).toHaveBeenCalledWith(mockUserGroupId);
  });

  it('throws Forbidden when the user is a non-admin group member (not Lead)', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.User,
    });
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupGitHubProviders({ id: mockUserGroupId }),
    ).rejects.toThrow(mockError);

    expect(getUserGroupGitHubProviders).not.toHaveBeenCalled();
  });

  it('throws Forbidden when the user has no group membership', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue(null);
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupGitHubProviders({ id: mockUserGroupId }),
    ).rejects.toThrow(mockError);

    expect(getUserGroupGitHubProviders).not.toHaveBeenCalled();
  });

  it('rejects an invalid user group id', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.getUserGroupGitHubProviders({ id: 'not-a-uuid' }),
    ).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(getUserGroupGitHubProviders).not.toHaveBeenCalled();
  });
});
