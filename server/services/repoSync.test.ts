jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    gitHubProvider: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import db from '@/server/db';
import {
  ensureRepoReady,
  isSyncing,
  waitForReady,
  __resetForTests,
} from './repoSync';

const mockFindMany = db.gitHubProvider.findMany as jest.Mock;
const mockUpdate = db.gitHubProvider.update as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  __resetForTests();
  global.fetch = jest.fn();
  mockUpdate.mockResolvedValue({});
});

describe('repoSync', () => {
  it('does nothing when no skill repos are configured', async () => {
    mockFindMany.mockResolvedValue([]);
    await ensureRepoReady();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls refresh for each skill repo provider', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'provider-1',
        apiBaseUrl: 'https://github.example.com/api/v3',
        owner: 'org',
        repo: 'skills',
        accessToken: 'token-123',
        skillRepoBranch: 'main',
      },
    ]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ commit: 'abc1234' }),
    });

    await ensureRepoReady();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/provider-1/refresh'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'provider-1' },
        data: expect.objectContaining({
          skillRepoLastSyncCommit: 'abc1234',
        }),
      }),
    );
  });

  it('isSyncing is true during a sync and false after', async () => {
    mockFindMany.mockResolvedValue([]);
    const promise = ensureRepoReady();
    expect(isSyncing()).toBe(true);
    await promise;
    expect(isSyncing()).toBe(false);
  });

  it('waitForReady returns true when not syncing', async () => {
    expect(await waitForReady(100)).toBe(true);
  });

  it('does not throw when fetch fails', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'provider-1',
        apiBaseUrl: 'https://github.example.com/api/v3',
        owner: 'org',
        repo: 'skills',
        accessToken: 'token',
        skillRepoBranch: 'main',
      },
    ]);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network error'));

    await expect(ensureRepoReady()).resolves.toBeUndefined();
  });
});
