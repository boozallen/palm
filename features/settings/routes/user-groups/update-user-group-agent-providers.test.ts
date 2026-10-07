import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import updateUserGroupAgentProviders from '@/features/settings/dal/user-groups/updateUserGroupAgentProviders';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

jest.mock('@/features/settings/dal/user-groups/updateUserGroupAgentProviders');
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  userGroup: { findUnique: jest.fn() },
  agentProvider: { findUnique: jest.fn() },
}));

describe('updateUserGroupAgentProvidersRoute', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockAgentProviderId = '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e';
  const mockAuditor = { createAuditRecord: jest.fn() };

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
      auditor: mockAuditor,
    } as unknown as ContextType;
    (getUser as jest.Mock).mockResolvedValue({ name: 'Alex Smith' });
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue({ label: 'Test Group' });
    (db.agentProvider.findUnique as jest.Mock).mockResolvedValue({ name: 'Test Agent' });
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
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'Alex Smith enabled agent provider "Test Agent" for user group "Test Group"',
      event: AuditRecordEvent.ModifyUserGroupAgentProviderAccess,
    });
  });

  it('audits a failure when the DAL call throws', async () => {
    ctx.userRole = UserRole.Admin;
    const dalError = new Error('Database connection lost');
    (updateUserGroupAgentProviders as jest.Mock).mockRejectedValue(dalError);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateUserGroupAgentProviders(mockInput)).rejects.toThrow('Database connection lost');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: 'Alex Smith failed to enable agent provider "Test Agent" for user group "Test Group": Database connection lost',
      event: AuditRecordEvent.ModifyUserGroupAgentProviderAccess,
    });
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
