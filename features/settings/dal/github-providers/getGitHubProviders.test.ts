import db from '@/server/db';
import getGitHubProviders from './getGitHubProviders';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  gitHubProvider: {
    findMany: jest.fn(),
  },
}));

describe('getGitHubProviders', () => {
  const mockProviders = [
    {
      id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
      label: 'Provider 1',
      accessToken: 'token-1',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
      description: 'Description 1',
      createdAt: new Date('2026-04-22T00:00:00.000Z'),
      updatedAt: new Date('2026-04-22T00:00:00.000Z'),
      deletedAt: null,
    },
    {
      id: 'a1234567-1234-1234-1234-123456789012',
      label: 'Provider 2',
      accessToken: 'token-2',
      apiBaseUrl: 'https://github.enterprise.com/api/v3',
      owner: 'otherorg',
      repo: 'other-repo',
      description: 'Description 2',
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all GitHub providers successfully', async () => {
    (db.gitHubProvider.findMany as jest.Mock).mockResolvedValue(mockProviders);

    const response = await getGitHubProviders();

    expect(db.gitHubProvider.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    expect(response).toEqual([
      {
        id: mockProviders[0].id,
        label: mockProviders[0].label,
        apiBaseUrl: mockProviders[0].apiBaseUrl,
        owner: mockProviders[0].owner,
        repo: mockProviders[0].repo,
        description: mockProviders[0].description,
        createdAt: mockProviders[0].createdAt,
        updatedAt: mockProviders[0].updatedAt,
      },
      {
        id: mockProviders[1].id,
        label: mockProviders[1].label,
        apiBaseUrl: mockProviders[1].apiBaseUrl,
        owner: mockProviders[1].owner,
        repo: mockProviders[1].repo,
        description: mockProviders[1].description,
        createdAt: mockProviders[1].createdAt,
        updatedAt: mockProviders[1].updatedAt,
      },
    ]);
  });

  it('returns empty array when no providers exist', async () => {
    (db.gitHubProvider.findMany as jest.Mock).mockResolvedValue([]);

    const response = await getGitHubProviders();

    expect(response).toEqual([]);
  });

  it('handles errors successfully', async () => {
    const error = new Error('Error fetching GitHub providers');
    (db.gitHubProvider.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getGitHubProviders()).rejects.toThrow(
      'Error fetching GitHub providers',
    );

    expect(logger.error).toHaveBeenCalledWith('Error fetching GitHub providers', error);
  });
});
