import pushArtifactToGitHub from './pushArtifactToGitHub';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';
import { GitHubFactory } from '@/features/github-provider/factory';

jest.mock('@/features/shared/dal/getAvailableGitHubProviders');
jest.mock('@/features/github-provider/factory');

const mockGetAvailableGitHubProviders = getAvailableGitHubProviders as jest.MockedFunction<
  typeof getAvailableGitHubProviders
>;
const MockGitHubFactory = GitHubFactory as jest.MockedClass<typeof GitHubFactory>;

const USER_ID = '10000000-0000-0000-0000-000000000001';
const SCOPE_ID = '20000000-0000-0000-0000-000000000002';
const PROVIDER_ID = '50000000-0000-0000-0000-000000000005';

const mockProvider = {
  id: PROVIDER_ID,
  label: 'My GitHub',
  description: '',
  apiBaseUrl: 'https://api.github.com',
  owner: 'myorg',
  repo: 'my-repo',
};

const mockPushFile = jest.fn();

const mockPushResult = {
  success: true,
  action: 'created' as const,
  filePath: 'artifacts/a1b2c3d4/my-presentation.html',
  url: 'https://github.com/myorg/my-repo/blob/main/artifacts/a1b2c3d4/my-presentation.html',
  downloadUrl:
    'https://raw.githubusercontent.com/myorg/my-repo/main/artifacts/a1b2c3d4/my-presentation.html',
  commit: {
    sha: 'abc123sha',
    message: 'Add artifact: My Presentation',
  },
};

const baseInput = {
  userId: USER_ID,
  content: '<h1>Hello</h1>',
  label: 'My Presentation',
  fileExtension: '.html',
  scopeId: SCOPE_ID,
};

beforeEach(() => {
  jest.clearAllMocks();

  mockGetAvailableGitHubProviders.mockResolvedValue([mockProvider]);
  mockPushFile.mockResolvedValue(mockPushResult);
  MockGitHubFactory.mockImplementation(
    () =>
      ({
        buildSource: jest.fn().mockResolvedValue({ source: { pushFile: mockPushFile } }),
      }) as any,
  );
});

describe('pushArtifactToGitHub', () => {
  it('throws when user has no available GitHub providers', async () => {
    mockGetAvailableGitHubProviders.mockResolvedValueOnce([]);

    await expect(pushArtifactToGitHub(baseInput)).rejects.toThrow(
      'You do not have access to any GitHub providers',
    );
  });

  it('throws when the specified provider is not in the user available providers', async () => {
    await expect(
      pushArtifactToGitHub({
        ...baseInput,
        githubProviderId: '99999999-0000-0000-0000-000000000009',
      }),
    ).rejects.toThrow('You do not have access to this GitHub provider');
  });

  it('throws when the file extension is not .html', async () => {
    await expect(
      pushArtifactToGitHub({ ...baseInput, fileExtension: '.md' }),
    ).rejects.toThrow('Only HTML artifacts can be pushed to GitHub.');
  });

  it('uses the first available provider when none is specified', async () => {
    await pushArtifactToGitHub(baseInput);

    expect(MockGitHubFactory).toHaveBeenCalledWith({ userId: USER_ID });
    expect(mockPushFile).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'myorg', repo: 'my-repo' }),
    );
  });

  it('uses the specified provider when it belongs to the user', async () => {
    const result = await pushArtifactToGitHub({ ...baseInput, githubProviderId: PROVIDER_ID });

    expect(result.success).toBe(true);
  });

  it('returns the correct shape with a pagesUrl on success', async () => {
    const result = await pushArtifactToGitHub(baseInput);

    expect(result.success).toBe(true);
    expect(result.action).toBe('created');
    expect(result.commitSha).toBe('abc123sha');
    expect(result.url).toContain('github.com');
    expect(result.pagesUrl).toBe('https://myorg.github.io/my-repo/artifacts/7e1cc874aa38/my-presentation.html');
  });

  it('derives a stable file path from the scopeId hash', async () => {
    await pushArtifactToGitHub(baseInput);

    const [pushCall] = mockPushFile.mock.calls;
    expect(pushCall[0].filePath).toMatch(/^artifacts\/[a-f0-9]{12}\/my-presentation\.html$/);
  });

  it('wraps push failures with a user-friendly error message', async () => {
    mockPushFile.mockRejectedValueOnce(new Error('GitHub API error'));

    await expect(pushArtifactToGitHub(baseInput)).rejects.toThrow(
      'Failed to push artifact to GitHub. Please try again.',
    );
  });
});
