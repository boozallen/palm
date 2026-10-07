import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import {
  UserGroupMembership,
  UserGroupRole,
} from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupKbProviders from '@/features/settings/dal/user-groups/updateUserGroupKbProviders';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/user-groups/updateUserGroupKbProviders');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  userGroup: { findUnique: jest.fn() },
  kbProvider: { findUnique: jest.fn() },
}));

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
    lastLoginAt: new Date('2024-01-01'),
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
  const mockAuditor = { createAuditRecord: jest.fn() };

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
      auditor: mockAuditor,
    } as unknown as ContextType;
    (getUser as jest.Mock).mockResolvedValue({ name: 'Alex Smith' });
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue({ label: 'Test Group' });
    (db.kbProvider.findUnique as jest.Mock).mockResolvedValue({ label: 'Test KB Provider' });
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
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'Alex Smith enabled knowledge base provider "Test KB Provider" for user group "Test Group"',
      event: AuditRecordEvent.ModifyUserGroupKbProviderAccess,
    });
  });

  it('audits a failure when the DAL call throws', async () => {
    ctx.userRole = UserRole.Admin;
    const dalError = new Error('Database connection lost');
    (updateUserGroupKbProviders as jest.Mock).mockRejectedValue(dalError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupKbProviders(mockInput)).rejects.toThrow('Database connection lost');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: 'Alex Smith failed to enable knowledge base provider "Test KB Provider" for user group "Test Group": Database connection lost',
      event: AuditRecordEvent.ModifyUserGroupKbProviderAccess,
    });
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
