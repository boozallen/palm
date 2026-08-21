import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserGroupRole } from '@/features/shared/types/user-group';
import getUserGroupAgentProviders from '@/features/settings/dal/user-groups/getUserGroupAgentProviders';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

jest.mock('@/features/settings/dal/user-groups/getUserGroupAgentProviders');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

describe('getUserGroupAgentProvidersRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockAgentProviders = [
    {
      id: '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e',
      name: 'Agent One',
      description: 'First agent',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  const mockMembershipLead = {
    userId: mockUserId,
    userGroupId: mockUserGroupId,
    role: UserGroupRole.Lead,
  };

  const mockMembershipUser = {
    userId: mockUserId,
    userGroupId: mockUserGroupId,
    role: UserGroupRole.User,
  };

  const mockError = Forbidden('You do not have permission to access this resource');

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows an Admin to get user group agent providers', async () => {
    ctx.userRole = UserRole.Admin;
    (getUserGroupAgentProviders as jest.Mock).mockResolvedValue(mockAgentProviders);

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupAgentProviders({ id: mockUserGroupId })
    ).resolves.toEqual({
      userGroupAgentProviders: mockAgentProviders.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(getUserGroupAgentProviders).toHaveBeenCalledWith(mockUserGroupId);
  });

  it('allows a group Lead to get user group agent providers', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembershipLead);
    (getUserGroupAgentProviders as jest.Mock).mockResolvedValue(mockAgentProviders);

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupAgentProviders({ id: mockUserGroupId })
    ).resolves.toEqual({
      userGroupAgentProviders: mockAgentProviders.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(getUserGroupAgentProviders).toHaveBeenCalled();
  });

  it('does not allow a non-Admin non-Lead to get user group agent providers', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembershipUser);

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupAgentProviders({ id: mockUserGroupId })
    ).rejects.toThrow(mockError);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(getUserGroupAgentProviders).not.toHaveBeenCalled();
  });

  it('rejects an invalid group id UUID', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.getUserGroupAgentProviders({ id: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(getUserGroupAgentProviders).not.toHaveBeenCalled();
  });
});
