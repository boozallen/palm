import db from '@/server/db';
import refreshSkillRepo from './refreshSkillRepo';

jest.mock('@/server/db', () => ({
  gitHubProvider: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const mockProvider = {
  id: 'provider-123',
  apiBaseUrl: 'https://github.example.com/api/v3',
  owner: 'myorg',
  repo: 'skill-repo',
  accessToken: 'ghp_test_token',
  isSkillRepo: true,
  skillRepoBranch: 'main',
  skillRepoServiceUrl: 'http://repo-service:8002',
  deletedAt: null,
};

describe('refreshSkillRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('returns error when provider not found', async () => {
    (db.gitHubProvider.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await refreshSkillRepo('nonexistent-id');

    expect(result).toEqual({ success: false, error: 'GitHub provider not found' });
    expect(db.gitHubProvider.findUnique).toHaveBeenCalledWith({
      where: { id: 'nonexistent-id', deletedAt: null },
    });
  });

  it('returns error when provider is not a skill repo', async () => {
    (db.gitHubProvider.findUnique as jest.Mock).mockResolvedValue({
      ...mockProvider,
      isSkillRepo: false,
    });

    const result = await refreshSkillRepo('provider-123');

    expect(result).toEqual({ success: false, error: 'This provider is not configured as a skill repo' });
  });

  it('refreshes successfully and updates database', async () => {
    (db.gitHubProvider.findUnique as jest.Mock).mockResolvedValue(mockProvider);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ commit: 'abc123', status: 'success' }),
    });
    (db.gitHubProvider.update as jest.Mock).mockResolvedValue({});

    const result = await refreshSkillRepo('provider-123');

    expect(result).toEqual({ success: true, commit: 'abc123', timestamp: undefined });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://repo-service:8002/repos/provider-123/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: 'https://github.example.com/myorg/skill-repo',
          access_token: 'ghp_test_token',
          branch: 'main',
        }),
      }),
    );
    expect(db.gitHubProvider.update).toHaveBeenCalledWith({
      where: { id: 'provider-123' },
      data: {
        skillRepoLastSyncAt: expect.any(Date),
        skillRepoLastSyncCommit: 'abc123',
      },
    });
  });

  it('uses default service URL when skillRepoServiceUrl is null', async () => {
    (db.gitHubProvider.findUnique as jest.Mock).mockResolvedValue({
      ...mockProvider,
      skillRepoServiceUrl: null,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ commit: 'def456' }),
    });
    (db.gitHubProvider.update as jest.Mock).mockResolvedValue({});

    await refreshSkillRepo('provider-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://repo-service:8002/repos/provider-123/refresh',
      expect.anything(),
    );
  });

  it('returns error when service responds with non-ok status', async () => {
    (db.gitHubProvider.findUnique as jest.Mock).mockResolvedValue(mockProvider);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'git clone failed' }),
    });

    const result = await refreshSkillRepo('provider-123');

    expect(result).toEqual({ success: false, error: 'git clone failed' });
    expect(db.gitHubProvider.update).not.toHaveBeenCalled();
  });

  it('returns error when fetch throws', async () => {
    (db.gitHubProvider.findUnique as jest.Mock).mockResolvedValue(mockProvider);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const result = await refreshSkillRepo('provider-123');

    expect(result).toEqual({ success: false, error: 'Failed to refresh: Connection refused' });
    expect(db.gitHubProvider.update).not.toHaveBeenCalled();
  });
});
