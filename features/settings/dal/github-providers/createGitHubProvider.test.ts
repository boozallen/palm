import db from '@/server/db';
import createGitHubProvider from './createGitHubProvider';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  gitHubProvider: {
    create: jest.fn(),
  },
}));

const mockResolvedValue = {
  id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
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
  label: mockResolvedValue.label,
  accessToken: mockResolvedValue.accessToken,
  apiBaseUrl: mockResolvedValue.apiBaseUrl,
  owner: mockResolvedValue.owner,
  repo: mockResolvedValue.repo,
  description: mockResolvedValue.description,
};

describe('createGitHubProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    expect(db.gitHubProvider.create).toHaveBeenCalledWith({
      data: {
        label: input.label,
        accessToken: input.accessToken,
        apiBaseUrl: input.apiBaseUrl,
        owner: input.owner,
        repo: input.repo,
        description: input.description,
        isSkillRepo: false,
        skillRepoBranch: null,
        skillRepoServiceUrl: null,
      },
    });
  });

  it('creates GitHub provider successfully', async () => {
    (db.gitHubProvider.create as jest.Mock).mockResolvedValue(mockResolvedValue);

    const response = await createGitHubProvider(input);

    expect(response).toEqual({
      id: mockResolvedValue.id,
      label: mockResolvedValue.label,
      apiBaseUrl: mockResolvedValue.apiBaseUrl,
      owner: mockResolvedValue.owner,
      repo: mockResolvedValue.repo,
      description: mockResolvedValue.description,
      createdAt: mockResolvedValue.createdAt,
      updatedAt: mockResolvedValue.updatedAt,
    });
    expect(response).not.toHaveProperty('accessToken');
  });

  it('handles errors successfully', async () => {
    const error = new Error('Error creating GitHub provider');
    (db.gitHubProvider.create as jest.Mock).mockRejectedValue(error);

    await expect(createGitHubProvider(input)).rejects.toThrow(
      'Error creating GitHub provider',
    );

    expect(logger.error).toHaveBeenCalledWith('Error creating GitHub provider', expect.objectContaining({ error }));
  });
});
