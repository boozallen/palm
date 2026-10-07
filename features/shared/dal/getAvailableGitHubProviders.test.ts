import db from '@/server/db';
import getAvailableGitHubProviders from './getAvailableGitHubProviders';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  gitHubProvider: {
    findMany: jest.fn(),
  },
}));

describe('getAvailableGitHubProviders', () => {
  const userId = 'f48c262b-435c-47db-97f2-5f7e4c3b34a6';

  const mockProviders = [
    {
      id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
      label: 'Provider 1',
      description: 'Description 1',
      apiBaseUrl: 'https://api.github.com',
      accessToken: 'token-1',
      createdAt: new Date('2026-04-22T00:00:00.000Z'),
      updatedAt: new Date('2026-04-22T00:00:00.000Z'),
    },
    {
      id: 'a1234567-1234-1234-1234-123456789012',
      label: 'Provider 2',
      description: 'Description 2',
      apiBaseUrl: 'https://github.enterprise.com/api/v3',
      accessToken: 'token-2',
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches available GitHub providers for a user successfully', async () => {
    (db.gitHubProvider.findMany as jest.Mock).mockResolvedValue(mockProviders);

    const response = await getAvailableGitHubProviders(userId);

    expect(db.gitHubProvider.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: { userId },
            },
          },
        },
      },
      orderBy: { label: 'asc' },
    });

    expect(response).toEqual([
      {
        id: mockProviders[0].id,
        label: mockProviders[0].label,
        description: mockProviders[0].description,
        apiBaseUrl: mockProviders[0].apiBaseUrl,
      },
      {
        id: mockProviders[1].id,
        label: mockProviders[1].label,
        description: mockProviders[1].description,
        apiBaseUrl: mockProviders[1].apiBaseUrl,
      },
    ]);
  });

  it('returns empty array when user has no available providers', async () => {
    (db.gitHubProvider.findMany as jest.Mock).mockResolvedValue([]);

    const response = await getAvailableGitHubProviders(userId);

    expect(response).toEqual([]);
  });

  it('handles errors successfully', async () => {
    const error = new Error('Error fetching available GitHub providers');
    (db.gitHubProvider.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getAvailableGitHubProviders(userId)).rejects.toThrow(
      'Error fetching available GitHub providers',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching available GitHub providers',
      error,
    );
  });
});
