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
import updateUserGroupAiAgents from '@/features/settings/dal/user-groups/updateUserGroupAiAgents';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/user-groups/updateUserGroupAiAgents');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  userGroup: { findUnique: jest.fn() },
  aiAgent: { findUnique: jest.fn() },
}));

describe('updateUserGroupAiAgents route', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockAiAgentId = '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e';
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
      id: mockAiAgentId,
      name: 'AI Agent 1',
      description: 'Description of AI Agent 1',
    },
  ];
  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  let mockCtx: ContextType;
  const mockAuditor = { createAuditRecord: jest.fn() };

  let mockInput: {
    userGroupId: string;
    aiAgentId: string;
    enabled: boolean;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      userGroupId: mockUserGroupId,
      aiAgentId: mockAiAgentId,
      enabled: true,
    };
    mockCtx = {
      userId: mockUserId,
      userRole: UserRole.User,
      auditor: mockAuditor,
    } as unknown as ContextType;
    (getUser as jest.Mock).mockResolvedValue({ name: 'Alex Smith' });
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue({ label: 'Test Group' });
    (db.aiAgent.findUnique as jest.Mock).mockResolvedValue({ name: 'AI Agent 1' });
  });

  it('should update the user group\'s AI Agents if user Role is Admin', async () => {
    mockCtx.userRole = UserRole.Admin;
    (updateUserGroupAiAgents as jest.Mock).mockResolvedValue(
      mockReturnValue
    );

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(caller.updateUserGroupAiAgents(mockInput)).resolves.toEqual(
      { userGroupAiAgents: mockReturnValue }
    );

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAiAgents).toHaveBeenCalledWith(mockInput);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'Alex Smith enabled AI agent "AI Agent 1" for user group "Test Group"',
      event: AuditRecordEvent.ModifyUserGroupAiAgentAccess,
    });
  });

  it('audits a failure when the DAL call throws', async () => {
    mockCtx.userRole = UserRole.Admin;
    const dalError = new Error('Database connection lost');
    (updateUserGroupAiAgents as jest.Mock).mockRejectedValue(dalError);

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(caller.updateUserGroupAiAgents(mockInput)).rejects.toThrow('Database connection lost');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: 'Alex Smith failed to enable AI agent "AI Agent 1" for user group "Test Group": Database connection lost',
      event: AuditRecordEvent.ModifyUserGroupAiAgentAccess,
    });
  });

  it('should update the user group\'s AI Agents if user Role is NOT Admin but their membership Role is Lead', async () => {
    mockCtx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.Lead;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);
    (updateUserGroupAiAgents as jest.Mock).mockResolvedValue(
      mockReturnValue
    );

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(caller.updateUserGroupAiAgents(mockInput)).resolves.toEqual(
      { userGroupAiAgents: mockReturnValue }
    );

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupAiAgents).toHaveBeenCalledWith(mockInput);
  });

  it('should throw an error if user Role is NOT Admin && userGroup role is NOT Lead', async () => {
    mockCtx.userRole = UserRole.User;
    mockMembership.role = UserGroupRole.User;
    (getUserGroupMembership as jest.Mock).mockResolvedValue(mockMembership);

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(caller.updateUserGroupAiAgents(mockInput)).rejects.toThrow(
      mockError
    );

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupAiAgents).not.toHaveBeenCalled();
  });

  it('rejects invalid aiAgentId input', async () => {
    mockInput.aiAgentId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(
      caller.updateUserGroupAiAgents(mockInput)
    ).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAiAgents).not.toHaveBeenCalled();
  });

  it('rejects invalid userGroupId input', async () => {
    mockInput.userGroupId = 'invalid-UUID';

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(
      caller.updateUserGroupAiAgents(mockInput)
    ).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupAiAgents).not.toHaveBeenCalled();
  });
});
