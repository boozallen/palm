import { UserRole } from '@/features/shared/types/user';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { ContextType } from '@/server/trpc-context';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import settingsRouter from '@/features/settings/routes';
import getUserGroupMembership from '@/features/settings/dal/user-groups/getUserGroupMembership';
import updateUserGroupGitHubProviders from '@/features/settings/dal/user-groups/updateUserGroupGitHubProviders';
import getUser from '@/features/settings/dal/shared/getUser';
import db from '@/server/db';

jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership');
jest.mock('@/features/settings/dal/user-groups/updateUserGroupGitHubProviders');
jest.mock('@/features/settings/dal/shared/getUser');
jest.mock('@/server/db', () => ({
  userGroup: { findUnique: jest.fn() },
  gitHubProvider: { findUnique: jest.fn() },
}));

describe('updateUserGroupGitHubProviders route', () => {
  const mockUserId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockGitHubProviderId = '9a2b467e-36ba-4d8f-ae5b-5eac0a62ac7e';

  const mockProviders = [
    {
      id: mockGitHubProviderId,
      label: 'My Provider',
      description: 'A test provider',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  const mockError = Forbidden('You do not have permission to access this resource');

  let mockInput: { userGroupId: string; githubProviderId: string; enabled: boolean };
  let ctx: ContextType;
  const mockAuditor = { createAuditRecord: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInput = {
      userGroupId: mockUserGroupId,
      githubProviderId: mockGitHubProviderId,
      enabled: true,
    };
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      auditor: mockAuditor,
    } as unknown as ContextType;
    (updateUserGroupGitHubProviders as jest.Mock).mockResolvedValue(mockProviders);
    (getUser as jest.Mock).mockResolvedValue({ name: 'Alex Smith' });
    (db.userGroup.findUnique as jest.Mock).mockResolvedValue({ label: 'Test Group' });
    (db.gitHubProvider.findUnique as jest.Mock).mockResolvedValue({ label: 'My Provider' });
  });

  it('updates providers when the user is an admin', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupGitHubProviders(mockInput)).resolves.toEqual({
      userGroupGitHubProviders: mockProviders,
    });

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupGitHubProviders).toHaveBeenCalledWith(mockInput);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      description: 'Alex Smith enabled GitHub provider "My Provider" for user group "Test Group"',
      event: AuditRecordEvent.ModifyUserGroupGithubProviderAccess,
    });
  });

  it('audits a failure when the DAL call throws', async () => {
    ctx.userRole = UserRole.Admin;
    const dalError = new Error('Database connection lost');
    (updateUserGroupGitHubProviders as jest.Mock).mockRejectedValue(dalError);
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupGitHubProviders(mockInput)).rejects.toThrow('Database connection lost');

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Error,
      description: 'Alex Smith failed to enable GitHub provider "My Provider" for user group "Test Group": Database connection lost',
      event: AuditRecordEvent.ModifyUserGroupGithubProviderAccess,
    });
  });

  it('updates providers when the user is a group Lead', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.Lead,
    });
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupGitHubProviders(mockInput)).resolves.toEqual({
      userGroupGitHubProviders: mockProviders,
    });

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupGitHubProviders).toHaveBeenCalledWith(mockInput);
  });

  it('throws Forbidden when the user is a non-admin group member (not Lead)', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      userGroupId: mockUserGroupId,
      role: UserGroupRole.User,
    });
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupGitHubProviders(mockInput)).rejects.toThrow(mockError);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupGitHubProviders).not.toHaveBeenCalled();
  });

  it('throws Forbidden when the user has no group membership', async () => {
    (getUserGroupMembership as jest.Mock).mockResolvedValue(null);
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupGitHubProviders(mockInput)).rejects.toThrow(mockError);

    expect(getUserGroupMembership).toHaveBeenCalled();
    expect(updateUserGroupGitHubProviders).not.toHaveBeenCalled();
  });

  it('rejects an invalid githubProviderId', async () => {
    mockInput.githubProviderId = 'not-a-uuid';
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupGitHubProviders(mockInput)).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupGitHubProviders).not.toHaveBeenCalled();
  });

  it('rejects an invalid userGroupId', async () => {
    mockInput.userGroupId = 'not-a-uuid';
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateUserGroupGitHubProviders(mockInput)).rejects.toThrow();

    expect(getUserGroupMembership).not.toHaveBeenCalled();
    expect(updateUserGroupGitHubProviders).not.toHaveBeenCalled();
  });
});
