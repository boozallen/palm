import db from '@/server/db';
import getGitHubProvider from './getGitHubProvider';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  gitHubProvider: {
    findFirst: jest.fn(),
  },
}));

describe('getGitHubProvider', () => {
  const providerId = 'd8283f19-fc06-40d2-ab82-52f7f02f2025';

  const mockProvider = {
    id: providerId,
    label: 'Test GitHub Provider',
    accessToken: 'ghp_test_token',
    apiBaseUrl: 'https://api.github.com',
    owner: 'myorg',
    repo: 'my-repo',
    description: 'This is a test GitHub provider',
    createdAt: new Date('2026-04-22T00:00:00.000Z'),
    updatedAt: new Date('2026-04-22T00:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches GitHub provider successfully', async () => {
    (db.gitHubProvider.findFirst as jest.Mock).mockResolvedValue(mockProvider);

    const response = await getGitHubProvider(providerId);

    expect(db.gitHubProvider.findFirst).toHaveBeenCalledWith({
      where: {
        id: providerId,
        deletedAt: null,
      },
    });

    expect(response).toEqual({
      id: mockProvider.id,
      label: mockProvider.label,
      accessToken: mockProvider.accessToken,
      apiBaseUrl: mockProvider.apiBaseUrl,
      owner: mockProvider.owner,
      repo: mockProvider.repo,
      description: mockProvider.description,
      createdAt: mockProvider.createdAt,
      updatedAt: mockProvider.updatedAt,
    });
  });

  it('returns null when provider does not exist', async () => {
    (db.gitHubProvider.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await getGitHubProvider(providerId);

    expect(response).toBeNull();
  });

  it('handles errors successfully', async () => {
    const error = new Error('Error fetching GitHub provider');
    (db.gitHubProvider.findFirst as jest.Mock).mockRejectedValue(error);

    await expect(getGitHubProvider(providerId)).rejects.toThrow(
      'Error fetching GitHub provider',
    );

    expect(logger.error).toHaveBeenCalledWith('Error fetching GitHub provider', expect.objectContaining({ error }));
  });
});
