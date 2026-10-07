import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import { GitHubFactory } from '@/features/github-provider/factory';

jest.mock('@/features/shared/dal/getAvailableGitHubProviders');
jest.mock('@/features/chat/dal/getMessage');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/updateChatArtifactGithubPagesUrl', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/github-provider/factory');

const mockGetAvailableGitHubProviders = getAvailableGitHubProviders as jest.MockedFunction<typeof getAvailableGitHubProviders>;
const mockGetMessage = getMessage as jest.MockedFunction<typeof getMessage>;
const mockGetChat = getChat as jest.MockedFunction<typeof getChat>;
const MockGitHubFactory = GitHubFactory as jest.MockedClass<typeof GitHubFactory>;

const USER_ID = '10000000-0000-0000-0000-000000000001';
const CHAT_ID = '20000000-0000-0000-0000-000000000002';
const MESSAGE_ID = '30000000-0000-0000-0000-000000000003';
const ARTIFACT_ID = '40000000-0000-0000-0000-000000000004';
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
  chatMessageId: MESSAGE_ID,
  createdAt: new Date(),
};

const mockPushFile = jest.fn();

const mockPushResult = {
  success: true,
  action: 'created' as const,
  filePath: 'artifacts/a1b2c3d4/2026-01-01-my-presentation.html',
  url: 'https://github.com/myorg/my-repo/blob/main/artifacts/a1b2c3d4/2026-01-01-my-presentation.html',
  downloadUrl: 'https://raw.githubusercontent.com/myorg/my-repo/main/artifacts/a1b2c3d4/2026-01-01-my-presentation.html',
  commit: {
    sha: 'abc123sha',
    message: 'Add artifact: My Presentation',
  },
};

const baseInput = {
  artifactId: ARTIFACT_ID,
  chatMessageId: MESSAGE_ID,
};

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
  mockGetMessage.mockResolvedValue({
    id: MESSAGE_ID,
    chatId: CHAT_ID,
    artifacts: [mockArtifact],
  } as any);
  mockGetChat.mockResolvedValue({
    id: CHAT_ID,
    userId: USER_ID,
  } as any);
  mockPushFile.mockResolvedValue(mockPushResult);
  MockGitHubFactory.mockImplementation(() => ({
    buildSource: jest.fn().mockResolvedValue({ source: { pushFile: mockPushFile } }),
  }) as any);
});

describe('pushArtifactToGithub route', () => {
  it('throws when user has no available GitHub providers', async () => {
    mockGetAvailableGitHubProviders.mockResolvedValueOnce([]);
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.pushArtifactToGithub(baseInput)).rejects.toThrow(
      'You do not have access to any GitHub providers',
    );
  });

  it('throws when the specified provider is not in the user available providers', async () => {
    const caller = chatRouter.createCaller(ctx);

    await expect(
      caller.pushArtifactToGithub({
        ...baseInput,
        githubProviderId: '99999999-0000-0000-0000-000000000009',
      }),
    ).rejects.toThrow('You do not have access to this GitHub provider');
  });

  it('throws when user does not own the chat and is not an admin', async () => {
    ctx.userId = 'other-user-id';
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.pushArtifactToGithub(baseInput)).rejects.toThrow(
      'You do not have permission to push this artifact',
    );
  });

  it('allows an admin to push an artifact from another user chat', async () => {
    ctx.userId = 'other-user-id';
    ctx.userRole = UserRole.Admin;
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.pushArtifactToGithub(baseInput);
    expect(result.success).toBe(true);
  });

  it('throws when the artifact is not found in the message', async () => {
    mockGetMessage.mockResolvedValueOnce({
      id: MESSAGE_ID,
      chatId: CHAT_ID,
      artifacts: [],
    } as any);
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.pushArtifactToGithub(baseInput)).rejects.toThrow('Artifact not found');
  });

  it('throws when the artifact is not an HTML file', async () => {
    mockGetMessage.mockResolvedValueOnce({
      id: MESSAGE_ID,
      chatId: CHAT_ID,
      artifacts: [{ ...mockArtifact, fileExtension: '.md' }],
    } as any);
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.pushArtifactToGithub(baseInput)).rejects.toThrow(
      'Only HTML artifacts can be pushed to GitHub.',
    );
  });

  it('pushes an HTML artifact and returns pagesUrl', async () => {
    const caller = chatRouter.createCaller(ctx);
    const result = await caller.pushArtifactToGithub(baseInput);

    expect(result.success).toBe(true);
    expect(result.action).toBe('created');
    expect(result.commitSha).toBe('abc123sha');
    expect(result.pagesUrl).toMatch(/^https:\/\//);
  });

  it('uses the first available provider when none is specified', async () => {
    const caller = chatRouter.createCaller(ctx);
    await caller.pushArtifactToGithub(baseInput);

    expect(MockGitHubFactory).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it('uses the specified provider when it belongs to the user', async () => {
    const caller = chatRouter.createCaller(ctx);
    const result = await caller.pushArtifactToGithub({
      ...baseInput,
      githubProviderId: PROVIDER_ID,
    });

    expect(result.success).toBe(true);
  });

  it('wraps push failures with a user-friendly error message', async () => {
    mockPushFile.mockRejectedValueOnce(new Error('GitHub API error'));
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.pushArtifactToGithub(baseInput)).rejects.toThrow(
      'Failed to push artifact to GitHub. Please try again.',
    );
  });
});
