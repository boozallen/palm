import sharedRouter from '@/features/shared/routes';
import { UserRole } from '@/features/shared/types/user';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getAvailableGitHubProviders', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('get-available-github-providers', () => {
  const userId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';

  const mockProviders = [
    {
      id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
      label: 'Provider 1',
      description: 'Description 1',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
    },
    {
      id: 'b1234567-1234-1234-1234-123456789012',
      label: 'Provider 2',
      description: 'Description 2',
      apiBaseUrl: 'https://github.enterprise.com/api/v3',
      owner: 'otherorg',
      repo: 'other-repo',
    },
  ];

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId,
      userRole: UserRole.User,
      prisma: {
        gitHubProvider: {
          findMany: jest.fn(),
        },
      },
    } as unknown as ContextType;
  });

  it('returns available GitHub providers for authenticated user', async () => {
    (getAvailableGitHubProviders as jest.Mock).mockResolvedValue(mockProviders);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getAvailableGitHubProviders()).resolves.toEqual({
      availableGitHubProviders: mockProviders,
    });
    expect(getAvailableGitHubProviders).toHaveBeenCalledWith(userId);
  });

  it('returns empty array when user has no available providers', async () => {
    (getAvailableGitHubProviders as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getAvailableGitHubProviders()).resolves.toEqual({
      availableGitHubProviders: [],
    });
    expect(getAvailableGitHubProviders).toHaveBeenCalledWith(userId);
  });

  it('should throw an error when the DAL throws an error', async () => {
    const errorMessage = 'Error fetching available GitHub providers';
    (getAvailableGitHubProviders as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.getAvailableGitHubProviders()).rejects.toThrow(errorMessage);
    expect(getAvailableGitHubProviders).toHaveBeenCalledWith(userId);
  });
});
