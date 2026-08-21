import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import {
  UserGroupRole,
  UserGroupMembership,
} from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupWorkflows from '@/features/settings/dal/user-groups/updateUserGroupWorkflows';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/user-groups/updateUserGroupWorkflows');

describe('updateUserGroupWorkflows route', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockMembership: UserGroupMembership = {
    name: 'Doe, John',
    userId: mockUserId,
    userGroupId: mockUserGroupId,
    role: UserGroupRole.Lead,
    email: 'doe_john@domain.com',
    lastLoginAt: new Date('2024-01-01'),
  };

  const mockReturnValue = {
    id: mockUserGroupId,
    label: 'Test Group',
    workflowsEnabled: true,
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  let mockInput: {
    userGroupId: string;
    workflowsEnabled: boolean;
  };
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      userGroupId: mockUserGroupId,
      workflowsEnabled: true,
    };
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should update the user group workflows if user role is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (updateUserGroupWorkflows as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupWorkflows(mockInput)).resolves.toEqual({
      userGroup: mockReturnValue,
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupWorkflows).toHaveBeenCalledWith(mockInput);
  });

  it('should update the user group workflows if user role is NOT Admin but their membership role is Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.Lead;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    (updateUserGroupWorkflows as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupWorkflows(mockInput)).resolves.toEqual({
      userGroup: mockReturnValue,
    });

    expect(getUserGroupMembership).toHaveBeenCalledWith(ctx.userId, mockUserGroupId);
    expect(updateUserGroupWorkflows).toHaveBeenCalledWith(mockInput);
  });

  it('should update the user group workflows to disabled', async () => {
    const disabledInput = {
      userGroupId: mockUserGroupId,
      workflowsEnabled: false,
    };
    const disabledResult = {
      ...mockReturnValue,
      workflowsEnabled: false,
    };

    ctx.userRole = UserRole.Admin;
    (updateUserGroupWorkflows as jest.Mock).mockResolvedValue(disabledResult);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupWorkflows(disabledInput)).resolves.toEqual({
      userGroup: disabledResult,
    });

    expect(updateUserGroupWorkflows).toHaveBeenCalledWith(disabledInput);
  });

  it('should throw an error if user role is NOT Admin && userGroup role is NOT Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupWorkflows(mockInput)).rejects.toThrow(
      mockError
    );

    expect(getUserGroupMembership).toHaveBeenCalledWith(ctx.userId, mockUserGroupId);
    expect(updateUserGroupWorkflows).not.toHaveBeenCalled();
  });

  it('should throw an error if user has no membership in the group', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupWorkflows(mockInput)).rejects.toThrow(
      mockError
    );

    expect(getUserGroupMembership).toHaveBeenCalledWith(ctx.userId, mockUserGroupId);
    expect(updateUserGroupWorkflows).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    mockInput.userGroupId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupWorkflows(mockInput)).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupWorkflows).not.toHaveBeenCalled();
  });

  it('should validate output schema', async () => {
    ctx.userRole = UserRole.Admin;
    (updateUserGroupWorkflows as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateUserGroupWorkflows(mockInput);

    expect(result).toHaveProperty('userGroup');
    expect(result.userGroup).toHaveProperty('id');
    expect(result.userGroup).toHaveProperty('label');
    expect(result.userGroup).toHaveProperty('workflowsEnabled');
    expect(result.userGroup).toHaveProperty('updatedAt');
    expect(typeof result.userGroup.workflowsEnabled).toBe('boolean');
  });
});