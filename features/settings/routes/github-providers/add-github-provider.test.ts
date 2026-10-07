import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import createGitHubProvider from '@/features/settings/dal/github-providers/createGitHubProvider';
import { TRPCError } from '@trpc/server';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/github-providers/createGitHubProvider', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('add-github-provider', () => {
  const mockProvider = {
    id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
    label: 'Test GitHub Provider',
    accessToken: 'ghp_test_token',
    apiBaseUrl: 'https://api.github.com',
    owner: 'myorg',
    repo: 'my-repo',
    description: 'This is a test GitHub provider',
    createdAt: new Date('2026-04-22T00:00:00.000Z'),
    updatedAt: new Date('2026-04-22T00:00:00.000Z'),
  };

  const input = {
    label: mockProvider.label,
    accessToken: mockProvider.accessToken,
    apiBaseUrl: mockProvider.apiBaseUrl,
    owner: mockProvider.owner,
    repo: mockProvider.repo,
    description: mockProvider.description,
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
          create: jest.fn(),
        },
      },
    } as unknown as ContextType;
  });

  it('allows a UserRole.Admin user to add a new GitHub provider', async () => {
    ctx.userRole = UserRole.Admin;

    (createGitHubProvider as jest.Mock).mockResolvedValue(mockProvider);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addGitHubProvider(input)).resolves.toEqual({
      githubProvider: {
        id: mockProvider.id,
        label: mockProvider.label,
        apiBaseUrl: mockProvider.apiBaseUrl,
        owner: mockProvider.owner,
        repo: mockProvider.repo,
        description: mockProvider.description,
        createdAt: mockProvider.createdAt,
        updatedAt: mockProvider.updatedAt,
      },
    });
    expect(createGitHubProvider).toHaveBeenCalledWith({
      label: input.label,
      accessToken: input.accessToken,
      apiBaseUrl: input.apiBaseUrl,
      owner: input.owner,
      repo: input.repo,
      description: input.description,
      isSkillRepo: false,
      skillRepoBranch: null,
      skillRepoServiceUrl: null,
    });
  });

  it('does not allow a UserRole.User user to add a GitHub provider', async () => {
    const error = new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You do not have permission to add a GitHub provider',
    });

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addGitHubProvider(input)).rejects.toThrow(error);
    expect(createGitHubProvider).not.toHaveBeenCalled();
  });

  it('should throw an error when the DAL throws an error', async () => {
    ctx.userRole = UserRole.Admin;
    const errorMessage = 'Error creating GitHub provider';
    (createGitHubProvider as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addGitHubProvider(input)).rejects.toThrow(errorMessage);
    expect(createGitHubProvider).toHaveBeenCalledWith({
      label: input.label,
      accessToken: input.accessToken,
      apiBaseUrl: input.apiBaseUrl,
      owner: input.owner,
      repo: input.repo,
      description: input.description,
      isSkillRepo: false,
      skillRepoBranch: null,
      skillRepoServiceUrl: null,
    });
  });

  it('validates required fields', async () => {
    ctx.userRole = UserRole.Admin;

    const invalidInput = {
      label: '',
      accessToken: '',
      apiBaseUrl: 'invalid-url',
      owner: '',
      repo: '',
      description: '',
    };

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.addGitHubProvider(invalidInput)).rejects.toThrow();
    expect(createGitHubProvider).not.toHaveBeenCalled();
  });
});
