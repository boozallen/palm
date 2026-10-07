import { storage } from '@/server/storage/redis';
import {
  GraphBuildCancelledError,
  graphCancelKey,
  requestGraphCancellation,
  isGraphCancellationRequested,
  clearGraphCancellation,
} from './graphCancellation';

jest.mock('@/server/storage/redis', () => ({
  storage: {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('graphCancellation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('graphCancelKey', () => {
    it('keys by graphId, not jobId', () => {
      expect(graphCancelKey('graph-123')).toBe('graph-cancel:graph-123');
    });
  });

  describe('GraphBuildCancelledError', () => {
    it('carries the graphId and a descriptive message', () => {
      const error = new GraphBuildCancelledError('graph-123');
      expect(error.graphId).toBe('graph-123');
      expect(error.name).toBe('GraphBuildCancelledError');
      expect(error.message).toBe('Graph build cancelled: graph-123');
    });
  });

  describe('requestGraphCancellation', () => {
    it('sets the flag with a 1 hour TTL', async () => {
      await requestGraphCancellation('graph-123');
      expect(mockStorage.setex).toHaveBeenCalledWith('graph-cancel:graph-123', 3600, '1');
    });
  });

  describe('isGraphCancellationRequested', () => {
    it('returns true when the flag is set', async () => {
      mockStorage.get.mockResolvedValue('1');
      await expect(isGraphCancellationRequested('graph-123')).resolves.toBe(true);
    });

    it('returns false when the flag is absent', async () => {
      mockStorage.get.mockResolvedValue(null);
      await expect(isGraphCancellationRequested('graph-123')).resolves.toBe(false);
    });

    it('fails open (false) when Redis rejects, never throws', async () => {
      mockStorage.get.mockRejectedValue(new Error('Redis down'));
      await expect(isGraphCancellationRequested('graph-123')).resolves.toBe(false);
    });
  });

  describe('clearGraphCancellation', () => {
    it('deletes the flag', async () => {
      await clearGraphCancellation('graph-123');
      expect(mockStorage.del).toHaveBeenCalledWith('graph-cancel:graph-123');
    });

    it('swallows a Redis rejection instead of throwing', async () => {
      mockStorage.del.mockRejectedValue(new Error('Redis down'));
      await expect(clearGraphCancellation('graph-123')).resolves.toBeUndefined();
    });
  });
});
