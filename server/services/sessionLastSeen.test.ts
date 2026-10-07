jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/server/storage/redis', () => ({
  storage: {
    setex: jest.fn(),
    get: jest.fn(),
  },
}));

import { storage } from '@/server/storage/redis';
import { touchLastSeen, wasRecentlyActive } from './sessionLastSeen';

const mockSetex = storage.setex as jest.Mock;
const mockGet = storage.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sessionLastSeen', () => {
  it('writes a TTL-bounded key for the user on touch', async () => {
    mockSetex.mockResolvedValue(undefined);

    await touchLastSeen('user-1');

    expect(mockSetex).toHaveBeenCalledWith('session-last-seen:user-1', expect.any(Number), '1');
  });

  it('does not throw when Redis is unavailable on touch', async () => {
    mockSetex.mockRejectedValue(new Error('Redis not initialized'));

    await expect(touchLastSeen('user-1')).resolves.toBeUndefined();
  });

  it('reports active when the last-seen key exists', async () => {
    mockGet.mockResolvedValue('1');

    await expect(wasRecentlyActive('user-1')).resolves.toBe(true);
  });

  it('reports inactive when the last-seen key is absent', async () => {
    mockGet.mockResolvedValue(null);

    await expect(wasRecentlyActive('user-1')).resolves.toBe(false);
  });

  it('fails open to inactive when Redis is unavailable on read', async () => {
    mockGet.mockRejectedValue(new Error('Redis not initialized'));

    await expect(wasRecentlyActive('user-1')).resolves.toBe(false);
  });
});
