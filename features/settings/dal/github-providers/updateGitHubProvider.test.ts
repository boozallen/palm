import db from '@/server/db';
import updateGitHubProvider from './updateGitHubProvider';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  gitHubProvider: {
    update: jest.fn(),
  },
}));

describe('updateGitHubProvider', () => {
  const providerId = 'd8283f19-fc06-40d2-ab82-52f7f02f2025';

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates GitHub provider successfully with access token', async () => {
    const input = {
      id: providerId,
      label: mockUpdatedProvider.label,
      accessToken: mockUpdatedProvider.accessToken,
      apiBaseUrl: mockUpdatedProvider.apiBaseUrl,
      owner: mockUpdatedProvider.owner,
      repo: mockUpdatedProvider.repo,
      description: mockUpdatedProvider.description,
    };

    (db.gitHubProvider.update as jest.Mock).mockResolvedValue(mockUpdatedProvider);

    const response = await updateGitHubProvider(input);

    expect(db.gitHubProvider.update).toHaveBeenCalledWith({
      where: { id: providerId },
      data: {
        label: input.label,
        accessToken: input.accessToken,
        apiBaseUrl: input.apiBaseUrl,
        owner: input.owner,
        repo: input.repo,
        description: input.description,
      },
    });

    expect(response).toEqual({
      id: mockUpdatedProvider.id,
      label: mockUpdatedProvider.label,
      apiBaseUrl: mockUpdatedProvider.apiBaseUrl,
      owner: mockUpdatedProvider.owner,
      repo: mockUpdatedProvider.repo,
      description: mockUpdatedProvider.description,
      createdAt: mockUpdatedProvider.createdAt,
      updatedAt: mockUpdatedProvider.updatedAt,
    });
    expect(response).not.toHaveProperty('accessToken');
  });

  it('updates GitHub provider successfully without access token', async () => {
    const input = {
      id: providerId,
      label: mockUpdatedProvider.label,
      apiBaseUrl: mockUpdatedProvider.apiBaseUrl,
      owner: mockUpdatedProvider.owner,
      repo: mockUpdatedProvider.repo,
      description: mockUpdatedProvider.description,
    };

    (db.gitHubProvider.update as jest.Mock).mockResolvedValue(mockUpdatedProvider);

    const response = await updateGitHubProvider(input);

    expect(db.gitHubProvider.update).toHaveBeenCalledWith({
      where: { id: providerId },
      data: {
        label: input.label,
        apiBaseUrl: input.apiBaseUrl,
        owner: input.owner,
        repo: input.repo,
        description: input.description,
      },
    });

    expect(response).toEqual({
      id: mockUpdatedProvider.id,
      label: mockUpdatedProvider.label,
      apiBaseUrl: mockUpdatedProvider.apiBaseUrl,
      owner: mockUpdatedProvider.owner,
      repo: mockUpdatedProvider.repo,
      description: mockUpdatedProvider.description,
      createdAt: mockUpdatedProvider.createdAt,
      updatedAt: mockUpdatedProvider.updatedAt,
    });
    expect(response).not.toHaveProperty('accessToken');
  });

  it('handles errors successfully', async () => {
    const input = {
      id: providerId,
      label: 'Test',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
      description: 'test',
    };

    const error = new Error('Error updating GitHub provider');
    (db.gitHubProvider.update as jest.Mock).mockRejectedValue(error);

    await expect(updateGitHubProvider(input)).rejects.toThrow(
      'Error updating GitHub provider',
    );

    expect(logger.error).toHaveBeenCalledWith('Error updating GitHub provider', expect.objectContaining({ error }));
  });
});
