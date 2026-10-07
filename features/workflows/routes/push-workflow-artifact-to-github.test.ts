import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import workflowsRouter from '@/features/workflows/routes';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';
import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';
import { GitHubFactory } from '@/features/github-provider/factory';

jest.mock('@/features/shared/dal/getAvailableGitHubProviders');
jest.mock('@/features/workflows/dal/getWorkflowArtifact');
jest.mock('@/features/workflows/dal/updateWorkflowArtifactGithubPagesUrl', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/github-provider/factory');
jest.mock('@/features/ai-agents/utils/crawler', () => ({
  HTMLReader: jest.fn(),
  PuppeteerCrawlerFactory: jest.fn(),
}));
jest.mock('@/features/workflows/utils/worker/queue', () => ({
  getWorkflowQueue: jest.fn(),
  closeWorkflowQueue: jest.fn(),
}));

const mockGetAvailableGitHubProviders = getAvailableGitHubProviders as jest.MockedFunction<
  typeof getAvailableGitHubProviders
>;
const mockGetWorkflowArtifact = getWorkflowArtifact as jest.MockedFunction<
  typeof getWorkflowArtifact
>;
const MockGitHubFactory = GitHubFactory as jest.MockedClass<typeof GitHubFactory>;

const USER_ID = '10000000-0000-0000-0000-000000000001';
const EXECUTION_ID = '20000000-0000-0000-0000-000000000002';
const ARTIFACT_ID = '60000000-0000-0000-0000-000000000006';
const PROVIDER_ID = '50000000-0000-0000-0000-000000000005';

const mockProvider = {
  id: PROVIDER_ID,
  label: 'My GitHub',
  description: '',
  apiBaseUrl: 'https://api.github.com',
  owner: 'myorg',
  repo: 'my-repo',
};

const mockArtifact = {
  id: ARTIFACT_ID,
  label: 'My Presentation',
  fileExtension: '.html',
  content: '<h1>Hello</h1>',
  workflowExecutionId: EXECUTION_ID,
  primitiveId: 'artifact-primitive-1',
  createdAt: new Date(),
  workflowExecution: {
    id: EXECUTION_ID,
    triggeredBy: USER_ID,
    workflowId: 'wf-1',
  },
};

const mockPushFile = jest.fn();

const mockPushResult = {
  success: true,
  action: 'created' as const,
  filePath: 'artifacts/a1b2c3d4/2026-01-01-my-presentation.html',
  url: 'https://github.com/myorg/my-repo/blob/main/artifacts/a1b2c3d4/2026-01-01-my-presentation.html',
  downloadUrl:
    'https://raw.githubusercontent.com/myorg/my-repo/main/artifacts/a1b2c3d4/2026-01-01-my-presentation.html',
  commit: {
    sha: 'abc123sha',
    message: 'Add artifact: My Presentation',
  },
};

const baseInput = { artifactId: ARTIFACT_ID };

let ctx: ContextType;

beforeEach(() => {
  jest.clearAllMocks();

  ctx = {
    userId: USER_ID,
    userRole: UserRole.User,
    logger,
    auditor: { createAuditRecord: jest.fn() },
  } as unknown as ContextType;

  mockGetAvailableGitHubProviders.mockResolvedValue([mockProvider]);
  mockGetWorkflowArtifact.mockResolvedValue(mockArtifact as any);
  mockPushFile.mockResolvedValue(mockPushResult);
  MockGitHubFactory.mockImplementation(
    () =>
      ({
        buildSource: jest.fn().mockResolvedValue({ source: { pushFile: mockPushFile } }),
      }) as any,
  );
});

describe('pushWorkflowArtifactToGithub route', () => {
  it('throws when user has no available GitHub providers', async () => {
    mockGetAvailableGitHubProviders.mockResolvedValueOnce([]);
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.pushWorkflowArtifactToGithub(baseInput)).rejects.toThrow(
      'You do not have access to any GitHub providers',
    );
  });

  it('throws when the specified provider is not in the user available providers', async () => {
    const caller = workflowsRouter.createCaller(ctx);

    await expect(
      caller.pushWorkflowArtifactToGithub({
        ...baseInput,
        githubProviderId: '99999999-0000-0000-0000-000000000009',
      }),
    ).rejects.toThrow('You do not have access to this GitHub provider');
  });

  it('throws when the artifact is not found', async () => {
    mockGetWorkflowArtifact.mockResolvedValueOnce(null);
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.pushWorkflowArtifactToGithub(baseInput)).rejects.toThrow(
      'Workflow artifact not found',
    );
  });

  it('throws when user did not trigger the execution and is not an admin', async () => {
    ctx.userId = 'other-user-id';
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.pushWorkflowArtifactToGithub(baseInput)).rejects.toThrow(
      'You do not have permission to push this artifact',
    );
  });

  it('allows an admin to push an artifact from another user execution', async () => {
    ctx.userId = 'other-user-id';
    ctx.userRole = UserRole.Admin;
    const caller = workflowsRouter.createCaller(ctx);

    const result = await caller.pushWorkflowArtifactToGithub(baseInput);
    expect(result.success).toBe(true);
  });

  it('throws when the artifact is not an HTML file', async () => {
    mockGetWorkflowArtifact.mockResolvedValueOnce({
      ...mockArtifact,
      fileExtension: '.md',
    } as any);
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.pushWorkflowArtifactToGithub(baseInput)).rejects.toThrow(
      'Only HTML artifacts can be pushed to GitHub.',
    );
  });

  it('pushes an HTML artifact and returns pagesUrl', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.pushWorkflowArtifactToGithub(baseInput);

    expect(result.success).toBe(true);
    expect(result.action).toBe('created');
    expect(result.commitSha).toBe('abc123sha');
    expect(result.pagesUrl).toMatch(/^https:\/\//);
  });

  it('uses the specified provider when it belongs to the user', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.pushWorkflowArtifactToGithub({
      ...baseInput,
      githubProviderId: PROVIDER_ID,
    });

    expect(result.success).toBe(true);
  });

  it('wraps push failures with a user-friendly error message', async () => {
    mockPushFile.mockRejectedValueOnce(new Error('GitHub API error'));
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.pushWorkflowArtifactToGithub(baseInput)).rejects.toThrow(
      'Failed to push artifact to GitHub. Please try again.',
    );
  });
});
