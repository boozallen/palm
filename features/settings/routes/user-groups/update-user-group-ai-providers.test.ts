import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import {
  UserGroupRole,
  UserGroupMembership,
} from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupAiProviders from '@/features/settings/dal/user-groups/updateUserGroupAiProviders';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/user-groups/updateUserGroupAiProviders');

describe('addAiProviderModelRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockAiProviderId = '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e';
  const mockMembership: UserGroupMembership = {
    name: 'Doe, John',
    userId: mockUserId,
    userGroupId: mockUserGroupId,
    role: UserGroupRole.Lead,
    email: 'doe_john@domain.com',
    lastLoginAt: new Date('2024-01-01'),
  };

  const mockReturnValue = [
    {
      id: mockAiProviderId,
      label: 'Test AI Provider',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  let mockInput: {
    userGroupId: string;
    aiProviderId: string;
    enabled: boolean;
  };
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      userGroupId: mockUserGroupId,
      aiProviderId: mockAiProviderId,
      enabled: true,
    };
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should update the user group\'s AiProviders if user Role is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (updateUserGroupAiProviders as jest.Mock).mockResolvedValue(
      mockReturnValue
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAiProviders(mockInput)).resolves.toEqual(
      { userGroupAiProviders: mockReturnValue }
    );

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAiProviders).toHaveBeenCalledWith(mockInput);
  });

  it('should update the user group\'s AiProviders if user Role is NOT Admin but their membership Role is Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.Lead;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    (updateUserGroupAiProviders as jest.Mock).mockResolvedValue(
      mockReturnValue
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAiProviders(mockInput)).resolves.toEqual(
      { userGroupAiProviders: mockReturnValue }
    );

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupAiProviders).toHaveBeenCalledWith(mockInput);
  });

  it('should throw an error if user Role is NOT Admin && userGroup role is NOT Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAiProviders(mockInput)).rejects.toThrow(
      mockError
    );

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupAiProviders).not.toHaveBeenCalled();
  });

  it('rejects invalid aiProviderId input', async () => {
    mockInput.aiProviderId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateUserGroupAiProviders(mockInput)
    ).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAiProviders).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    mockInput.userGroupId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateUserGroupAiProviders(mockInput)
    ).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAiProviders).not.toHaveBeenCalled();
  });
});
