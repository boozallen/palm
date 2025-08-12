import { waitFor } from '@testing-library/dom';

import { startResearchWorker } from './researchWorker';
import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { getRedisClient } from '@/server/storage/redisConnection';

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    isRunning: jest.fn().mockReturnValue(false),
    run: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/server/storage/redis', () => ({
  storage: {
    del: jest.fn(),
    hset: jest.fn(),
  },
}));

jest.mock('@/server/storage/redisConnection');

jest.mock('./researchAnalysis', () => ({
  performResearchAnalysis: jest.fn().mockResolvedValue({
    papers: [],
    paperCount: 0,
    institutionCount: 0,
    categoryCount: {},
    analysis: 'Mock analysis',
  }),
}));

describe('startResearchWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockReturnValue({ host: 'localhost', port: 6379 });
  });

  it('should start worker successfully', async () => {
    await expect(startResearchWorker()).resolves.toBeUndefined();

     waitFor(() => {
      expect(storage.hset).toHaveBeenCalledWith(/research-job/);
    });
  });

  it('should handle Redis unavailable', async () => {
    (getRedisClient as jest.Mock).mockImplementation(() => {
      throw new Error('Redis not available');
    });

    await expect(startResearchWorker()).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      'Redis not available — skipping research queue/worker startup.'
    );
  });
});
