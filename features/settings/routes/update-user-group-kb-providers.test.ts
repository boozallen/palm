import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import {
  UserGroupMembership,
  UserGroupRole,
} from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import getUserGroupMembership from '@/features/settings/dal/getUserGroupMembership';
import updateUserGroupKbProviders from '@/features/settings/dal/updateUserGroupKbProviders';

jest.mock('@/features/settings/dal/getUserGroupMembership');
jest.mock('@/features/settings/dal/updateUserGroupKbProviders');

describe('updateUserGroupKbProvidersRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockAiProviderId = '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e';
  const mockMembership: UserGroupMembership = {
    name: 'Doe, John',
    userId: mockUserId,
    userGroupId: mockUserGroupId,
    role: UserGroupRole.Lead,
    email: 'doe_john@domain.com',
  };

  const mockResolvedValue = [
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17b',
    },
  ];

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  let mockInput: {
    userGroupId: string;
    kbProviderId: string;
    enabled: boolean;
  };
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      userGroupId: mockUserGroupId,
      kbProviderId: mockAiProviderId,
      enabled: true,
    };
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should update the user group\'s kbProviders if user Role is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (updateUserGroupKbProviders as jest.Mock).mockResolvedValue(
      mockResolvedValue
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupKbProviders(mockInput)).resolves.toEqual(
      { userGroupKbProviders: mockResolvedValue }
    );

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupKbProviders).toHaveBeenCalledWith(mockInput);
  });

  it('should update the user group\'s kbProviders if user Role is NOT Admin but their membership Role is Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.Lead;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    (updateUserGroupKbProviders as jest.Mock).mockResolvedValue(
      mockResolvedValue
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupKbProviders(mockInput)).resolves.toEqual(
      { userGroupKbProviders: mockResolvedValue }
    );

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupKbProviders).toHaveBeenCalledWith(mockInput);
  });

  it('should throw an error if user Role is NOT Admin && userGroup role is NOT Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupKbProviders(mockInput)).rejects.toThrow(
      mockError
    );

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupKbProviders).not.toHaveBeenCalled();
  });

  it('rejects invalid kbProviderId input', async () => {
    mockInput.kbProviderId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateUserGroupKbProviders(mockInput)
    ).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupKbProviders).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    mockInput.userGroupId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(
      caller.updateUserGroupKbProviders(mockInput)
    ).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupKbProviders).not.toHaveBeenCalled();
  });
});
