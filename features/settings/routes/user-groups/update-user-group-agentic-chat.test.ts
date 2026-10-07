import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import {
  UserGroupRole,
  UserGroupMembership,
} from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupAgenticChat from '@/features/settings/dal/user-groups/updateUserGroupAgenticChat';
import getUser from '@/features/settings/dal/shared/getUser';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/user-groups/updateUserGroupAgenticChat');
jest.mock('@/features/settings/dal/shared/getUser');

describe('updateUserGroupAgenticChat route', () => {
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
    agenticChatEnabled: true,
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  let mockInput: {
    userGroupId: string;
    agenticChatEnabled: boolean;
  };
  let ctx: ContextType;
  const mockAuditor = { createAuditRecord: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      userGroupId: mockUserGroupId,
      agenticChatEnabled: true,
    };
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      auditor: mockAuditor,
    } as unknown as ContextType;
    (getUser as jest.Mock).mockResolvedValue({ name: 'Alex Smith' });
  });

  it('should update the user group agentic chat access if user role is Admin', async () => {
    ctx.userRole = UserRole.Admin;
    (updateUserGroupAgenticChat as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgenticChat(mockInput)).resolves.toEqual({
      userGroup: mockReturnValue,
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAgenticChat).toHaveBeenCalledWith(mockInput);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'Alex Smith enabled agentic chat access for user group "Test Group"',
      event: AuditRecordEvent.ModifyUserGroupAgenticChatAccess,
    });
  });

  it('audits a failure when the DAL call throws', async () => {
    ctx.userRole = UserRole.Admin;
    const dalError = new Error('Database connection lost');
    (updateUserGroupAgenticChat as jest.Mock).mockRejectedValue(dalError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgenticChat(mockInput)).rejects.toThrow('Database connection lost');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: `Alex Smith failed to enable agentic chat access for user group ${mockUserGroupId}: Database connection lost`,
      event: AuditRecordEvent.ModifyUserGroupAgenticChatAccess,
    });
  });

  it('should update the user group agentic chat access if user role is NOT Admin but their membership role is Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.Lead;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    (updateUserGroupAgenticChat as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgenticChat(mockInput)).resolves.toEqual({
      userGroup: mockReturnValue,
    });

    expect(getUserGroupMembership).toHaveBeenCalledWith(ctx.userId, mockUserGroupId);
    expect(updateUserGroupAgenticChat).toHaveBeenCalledWith(mockInput);
  });

  it('should update the user group agentic chat access to disabled', async () => {
    const disabledInput = {
      userGroupId: mockUserGroupId,
      agenticChatEnabled: false,
    };
    const disabledResult = {
      ...mockReturnValue,
      agenticChatEnabled: false,
    };

    ctx.userRole = UserRole.Admin;
    (updateUserGroupAgenticChat as jest.Mock).mockResolvedValue(disabledResult);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgenticChat(disabledInput)).resolves.toEqual({
      userGroup: disabledResult,
    });

    expect(updateUserGroupAgenticChat).toHaveBeenCalledWith(disabledInput);
  });

  it('should throw an error if user role is NOT Admin && userGroup role is NOT Lead', async () => {
    ctx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgenticChat(mockInput)).rejects.toThrow(
      mockError
    );

    expect(getUserGroupMembership).toHaveBeenCalledWith(ctx.userId, mockUserGroupId);
    expect(updateUserGroupAgenticChat).not.toHaveBeenCalled();
  });

  it('should throw an error if user has no membership in the group', async () => {
    ctx.userRole = UserRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgenticChat(mockInput)).rejects.toThrow(
      mockError
    );

    expect(getUserGroupMembership).toHaveBeenCalledWith(ctx.userId, mockUserGroupId);
    expect(updateUserGroupAgenticChat).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    mockInput.userGroupId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgenticChat(mockInput)).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAgenticChat).not.toHaveBeenCalled();
  });
});
