import { GitHubFactory, GitHubFactoryConfig } from './factory';
import logger from '@/server/logger';
import getGitHubProvider from '@/features/settings/dal/github-providers/getGitHubProvider';
import { GitHubProvider } from '@/features/shared/types/github-provider';
import { GitHubSource } from './sources/github';

jest.mock('@/features/settings/dal/github-providers/getGitHubProvider');
jest.mock('./sources/github');

describe('GitHubFactory', () => {
  const userId = 'test-user-id';
  const config: GitHubFactoryConfig = { userId };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw an error if userId is missing', () => {
      expect(() => new GitHubFactory({ userId: '' })).toThrow('Missing required configuration properties');
      expect(logger.error).toHaveBeenCalledWith('Missing required configuration properties: config.userId');
    });

    it('should not throw an error if userId is provided', () => {
      expect(() => new GitHubFactory(config)).not.toThrow();
    });
  });

  describe('buildSource', () => {
    const providerId = 'test-provider-id';
    const mockProvider: GitHubProvider = {
      id: providerId,
      label: 'Test Provider',
      accessToken: 'test-token',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
      description: 'Test description',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    beforeEach(() => {
      (getGitHubProvider as jest.Mock).mockResolvedValue(mockProvider);
      (GitHubSource as jest.Mock).mockImplementation(() => ({}));
    });

    it('should return a BuildResult object on success', async () => {
      const factory = new GitHubFactory(config);
      const result = await factory.buildSource(providerId);

      expect(result).toEqual({
        source: expect.any(Object),
        provider: mockProvider,
      });
      expect(getGitHubProvider).toHaveBeenCalledWith(providerId);
      expect(GitHubSource).toHaveBeenCalledWith({
        accessToken: mockProvider.accessToken,
        apiBaseUrl: mockProvider.apiBaseUrl,
      });
    });

    it('should throw an error if provider is not found', async () => {
      (getGitHubProvider as jest.Mock).mockResolvedValue(null);

      const factory = new GitHubFactory(config);

      await expect(factory.buildSource(providerId)).rejects.toThrow(`Error building GitHub source for id ${providerId}`);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log an error and throw an error if getGitHubProvider fails', async () => {
      const error = new Error('Test error');
      (getGitHubProvider as jest.Mock).mockRejectedValue(error);

      const factory = new GitHubFactory(config);

      await expect(factory.buildSource(providerId)).rejects.toThrow(`Error building GitHub source for id ${providerId}`);
      expect(logger.error).toHaveBeenCalledWith(`Error building GitHub source for id ${providerId}`, error);
    });
  });

  describe('buildClient', () => {
    const mockProvider: GitHubProvider = {
      id: 'test-id',
      label: 'Test Provider',
      accessToken: 'test-token',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
      description: 'Test description',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return an instance of GitHubSource', () => {
      const factory = new GitHubFactory(config);

      (GitHubSource as jest.Mock).mockImplementation(() => ({}));

      const source = factory['buildClient'](mockProvider);

      expect(source).toEqual(expect.any(Object));
      expect(GitHubSource).toHaveBeenCalledWith({
        accessToken: mockProvider.accessToken,
        apiBaseUrl: mockProvider.apiBaseUrl,
      });
    });
  });
});
