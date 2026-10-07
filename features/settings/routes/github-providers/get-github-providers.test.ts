import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import getGitHubProviders from '@/features/settings/dal/github-providers/getGitHubProviders';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/github-providers/getGitHubProviders', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('get-github-providers', () => {
  const mockProviders = [
    {
      id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
      label: 'Provider 1',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
      description: 'Description 1',
      createdAt: new Date('2026-04-22T00:00:00.000Z'),
      updatedAt: new Date('2026-04-22T00:00:00.000Z'),
      isSkillRepo: false,
      skillRepoBranch: null,
      skillRepoServiceUrl: null,
      skillRepoLastSyncAt: null,
      skillRepoLastSyncCommit: null,
    },
    {
      id: 'b1234567-1234-1234-1234-123456789012',
      label: 'Provider 2',
      apiBaseUrl: 'https://github.enterprise.com/api/v3',
      owner: 'otherorg',
      repo: 'other-repo',
      description: 'Description 2',
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      isSkillRepo: true,
      skillRepoBranch: 'main',
      skillRepoServiceUrl: null,
      skillRepoLastSyncAt: null,
      skillRepoLastSyncCommit: null,
    },
  ];

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: 'f48c262b-435c-47db-97f2-5f7e4c3b34a6',
      userRole: UserRole.User,
      prisma: {
        gitHubProvider: {
          findMany: jest.fn(),
        },
      },
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to get GitHub providers', async () => {
    ctx.userRole = UserRole.Admin;

    (getGitHubProviders as jest.Mock).mockResolvedValue(mockProviders);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProviders()).resolves.toEqual({
      githubProviders: mockProviders,
    });
    expect(getGitHubProviders).toHaveBeenCalled();
  });

  it('does not allow a UserRole.User user to get GitHub providers', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to view GitHub providers',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProviders()).rejects.toThrow(error);
    expect(getGitHubProviders).not.toHaveBeenCalled();
  });

  it('returns empty array when no providers exist', async () => {
    ctx.userRole = UserRole.Admin;

    (getGitHubProviders as jest.Mock).mockResolvedValue([]);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProviders()).resolves.toEqual({
      githubProviders: [],
    });
    expect(getGitHubProviders).toHaveBeenCalled();
  });

  it('should throw an error when the DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    const errorMessage = 'Error fetching GitHub providers';
    (getGitHubProviders as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProviders()).rejects.toThrow(errorMessage);
    expect(getGitHubProviders).toHaveBeenCalled();
  });
});
