import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import getGitHubProvider from '@/features/settings/dal/github-providers/getGitHubProvider';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/github-providers/getGitHubProvider', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('get-github-provider', () => {
  const providerId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockProvider = {
    id: providerId,
    label: 'Test GitHub Provider',
    accessToken: 'ghp_test_token',
    apiBaseUrl: 'https://api.github.com',
    description: 'This is a test GitHub provider',
    createdAt: new Date('2026-04-22T00:00:00.000Z'),
    updatedAt: new Date('2026-04-22T00:00:00.000Z'),
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: 'f48c262b-435c-47db-97f2-5f7e4c3b34a6',
      userRole: UserRole.User,
      prisma: {
        gitHubProvider: {
          findFirst: jest.fn(),
        },
      },
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to get a GitHub provider', async () => {
    ctx.userRole = UserRole.Admin;

    (getGitHubProvider as jest.Mock).mockResolvedValue(mockProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProvider({ id: providerId })).resolves.toEqual({
      githubProvider: {
        id: mockProvider.id,
        label: mockProvider.label,
        apiBaseUrl: mockProvider.apiBaseUrl,
        description: mockProvider.description,
        createdAt: mockProvider.createdAt,
        updatedAt: mockProvider.updatedAt,
      },
    });
    expect(getGitHubProvider).toHaveBeenCalledWith(providerId);
  });

  it('does not allow a UserRole.User user to get a GitHub provider', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to view GitHub providers',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProvider({ id: providerId })).rejects.toThrow(error);
    expect(getGitHubProvider).not.toHaveBeenCalled();
  });

  it('returns null when provider does not exist', async () => {
    ctx.userRole = UserRole.Admin;

    (getGitHubProvider as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProvider({ id: providerId })).resolves.toEqual({
      githubProvider: null,
    });
    expect(getGitHubProvider).toHaveBeenCalledWith(providerId);
  });

  it('should throw an error when the DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    const errorMessage = 'Error fetching GitHub provider';
    (getGitHubProvider as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProvider({ id: providerId })).rejects.toThrow(errorMessage);
    expect(getGitHubProvider).toHaveBeenCalledWith(providerId);
  });

  it('validates id is a UUID', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getGitHubProvider({ id: 'invalid-uuid' })).rejects.toThrow();
    expect(getGitHubProvider).not.toHaveBeenCalled();
  });
});
