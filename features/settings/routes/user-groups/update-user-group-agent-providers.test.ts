import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserGroupRole } from '@/features/shared/types/user-group';
import updateUserGroupAgentProviders from '@/features/settings/dal/user-groups/updateUserGroupAgentProviders';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';

jest.mock('@/features/settings/dal/user-groups/updateUserGroupAgentProviders');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');

describe('updateUserGroupAgentProvidersRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockAgentProviderId = '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e';

  const mockReturnValue = [
    {
      id: mockAgentProviderId,
      name: 'Test Agent',
      description: 'A test agent',
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

  let mockInput: { userGroupId: string; agentProviderId: string; enabled: boolean };
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInput = {
      userGroupId: mockUserGroupId,
      agentProviderId: mockAgentProviderId,
      enabled: true,
    };
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('allows an Admin to update user group agent providers', async () => {
    ctx.userRole = UserRole.Admin;
    (updateUserGroupAgentProviders as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgentProviders(mockInput)).resolves.toEqual({
      userGroupAgentProviders: mockReturnValue.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAgentProviders).toHaveBeenCalledWith(mockInput);
  });

  it('allows a group Lead to update user group agent providers', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembershipLead);
    (updateUserGroupAgentProviders as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgentProviders(mockInput)).resolves.toEqual({
      userGroupAgentProviders: mockReturnValue.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupAgentProviders).toHaveBeenCalledWith(mockInput);
  });

  it('does not allow a non-Admin non-Lead to update user group agent providers', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembershipUser);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgentProviders(mockInput)).rejects.toThrow(mockError);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupAgentProviders).not.toHaveBeenCalled();
  });

  it('rejects an invalid agentProviderId UUID', async () => {
    mockInput.agentProviderId = 'not-a-uuid';
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgentProviders(mockInput)).rejects.toThrow();
    expect(updateUserGroupAgentProviders).not.toHaveBeenCalled();
  });

  it('rejects an invalid userGroupId UUID', async () => {
    mockInput.userGroupId = 'not-a-uuid';
    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgentProviders(mockInput)).rejects.toThrow();
    expect(updateUserGroupAgentProviders).not.toHaveBeenCalled();
  });
});
