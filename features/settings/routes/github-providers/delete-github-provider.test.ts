import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import getGitHubProvider from '@/features/settings/dal/github-providers/getGitHubProvider';
import deleteGitHubProvider from '@/features/settings/dal/github-providers/deleteGitHubProvider';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/github-providers/getGitHubProvider', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/settings/dal/github-providers/deleteGitHubProvider', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('delete-github-provider', () => {
  const providerId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockProvider = {
    id: providerId,
    label: 'My GitHub Provider',
    accessToken: 'ghp_token',
    apiBaseUrl: 'https://api.github.com',
    owner: 'myorg',
    repo: 'my-repo',
    description: '',
    createdAt: new Date('2026-04-22T00:00:00.000Z'),
    updatedAt: new Date('2026-04-22T00:00:00.000Z'),
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getGitHubProvider as jest.Mock).mockResolvedValue(mockProvider);

    ctx = {
      userId: 'f48c262b-435c-47db-97f2-5f7e4c3b34a6',
      userRole: UserRole.User,
      auditor: {
        createAuditRecord: jest.fn(),
      },
      prisma: {
        gitHubProvider: {
          update: jest.fn(),
        },
      },
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to delete a GitHub provider', async () => {
    ctx.userRole = UserRole.Admin;

    (deleteGitHubProvider as jest.Mock).mockResolvedValue(undefined);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteGitHubProvider({ id: providerId })).resolves.toEqual({
      success: true,
    });
    expect(deleteGitHubProvider).toHaveBeenCalledWith(providerId);
  });

  // Deleting a GitHub provider is recorded in the audit log, matching add/update coverage.
  it('records an audit entry naming the deleted provider', async () => {
    ctx.userRole = UserRole.Admin;

    (deleteGitHubProvider as jest.Mock).mockResolvedValue(undefined);

    const caller = settingsRouter.createCaller(ctx);
    await caller.deleteGitHubProvider({ id: providerId });

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteGithubProvider,
      description: `GitHub provider "${mockProvider.label}" was deleted`,
    });
  });

  it('does not allow a UserRole.User user to delete a GitHub provider', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to delete a GitHub provider',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteGitHubProvider({ id: providerId })).rejects.toThrow(error);
    expect(deleteGitHubProvider).not.toHaveBeenCalled();
  });

  it('should throw an error when the DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    const errorMessage = 'Error deleting GitHub provider';
    (deleteGitHubProvider as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteGitHubProvider({ id: providerId })).rejects.toThrow(errorMessage);
    expect(deleteGitHubProvider).toHaveBeenCalledWith(providerId);
  });

  it('validates id is a UUID', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.deleteGitHubProvider({ id: 'invalid-uuid' })).rejects.toThrow();
    expect(deleteGitHubProvider).not.toHaveBeenCalled();
  });
});
