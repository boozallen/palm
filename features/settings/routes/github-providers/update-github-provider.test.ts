import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import updateGitHubProvider from '@/features/settings/dal/github-providers/updateGitHubProvider';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/github-providers/updateGitHubProvider', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('update-github-provider', () => {
  const providerId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockUpdatedProvider = {
    id: providerId,
    label: 'Updated GitHub Provider',
    accessToken: 'ghp_updated_token',
    apiBaseUrl: 'https://github.enterprise.com/api/v3',
    owner: 'myorg',
    repo: 'my-repo',
    description: 'Updated description',
    createdAt: new Date('2026-04-22T00:00:00.000Z'),
    updatedAt: new Date('2026-04-22T12:00:00.000Z'),
  };

  const input = {
    id: providerId,
    label: mockUpdatedProvider.label,
    accessToken: mockUpdatedProvider.accessToken,
    apiBaseUrl: mockUpdatedProvider.apiBaseUrl,
    owner: mockUpdatedProvider.owner,
    repo: mockUpdatedProvider.repo,
    description: mockUpdatedProvider.description,
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

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

  it('allows a UserRole.Admin user to update a GitHub provider', async () => {
    ctx.userRole = UserRole.Admin;

    (updateGitHubProvider as jest.Mock).mockResolvedValue(mockUpdatedProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateGitHubProvider(input)).resolves.toEqual({
      githubProvider: {
        id: mockUpdatedProvider.id,
        label: mockUpdatedProvider.label,
        apiBaseUrl: mockUpdatedProvider.apiBaseUrl,
        owner: mockUpdatedProvider.owner,
        repo: mockUpdatedProvider.repo,
        description: mockUpdatedProvider.description,
        createdAt: mockUpdatedProvider.createdAt,
        updatedAt: mockUpdatedProvider.updatedAt,
      },
    });
    expect(updateGitHubProvider).toHaveBeenCalledWith({
      id: input.id,
      label: input.label,
      accessToken: input.accessToken,
      apiBaseUrl: input.apiBaseUrl,
      owner: input.owner,
      repo: input.repo,
      description: input.description,
    });
  });

  it('does not allow a UserRole.User user to update a GitHub provider', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to update a GitHub provider',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateGitHubProvider(input)).rejects.toThrow(error);
    expect(updateGitHubProvider).not.toHaveBeenCalled();
  });

  it('allows updating without access token', async () => {
    ctx.userRole = UserRole.Admin;

    const { accessToken: _accessToken, ...inputWithoutToken } = input;

    (updateGitHubProvider as jest.Mock).mockResolvedValue(mockUpdatedProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateGitHubProvider(inputWithoutToken)).resolves.toEqual({
      githubProvider: {
        id: mockUpdatedProvider.id,
        label: mockUpdatedProvider.label,
        apiBaseUrl: mockUpdatedProvider.apiBaseUrl,
        owner: mockUpdatedProvider.owner,
        repo: mockUpdatedProvider.repo,
        description: mockUpdatedProvider.description,
        createdAt: mockUpdatedProvider.createdAt,
        updatedAt: mockUpdatedProvider.updatedAt,
      },
    });
    expect(updateGitHubProvider).toHaveBeenCalledWith({
      id: inputWithoutToken.id,
      label: inputWithoutToken.label,
      accessToken: undefined,
      apiBaseUrl: inputWithoutToken.apiBaseUrl,
      owner: inputWithoutToken.owner,
      repo: inputWithoutToken.repo,
      description: inputWithoutToken.description,
    });
  });

  it('should throw an error when the DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    const errorMessage = 'Error updating GitHub provider';
    (updateGitHubProvider as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateGitHubProvider(input)).rejects.toThrow(errorMessage);
    expect(updateGitHubProvider).toHaveBeenCalledWith({
      id: input.id,
      label: input.label,
      accessToken: input.accessToken,
      apiBaseUrl: input.apiBaseUrl,
      owner: input.owner,
      repo: input.repo,
      description: input.description,
    });
  });

  it('validates required fields', async () => {
    ctx.userRole = UserRole.Admin;

    const invalidInput = {
      id: providerId,
      label: '',
      apiBaseUrl: 'invalid-url',
      owner: '',
      repo: '',
      description: '',
    };

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateGitHubProvider(invalidInput)).rejects.toThrow();
    expect(updateGitHubProvider).not.toHaveBeenCalled();
  });
});
