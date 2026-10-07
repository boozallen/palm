import { Worker } from 'bullmq';
import { waitFor } from '@testing-library/dom';

import { startRadarWorker } from './worker';
import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { getRedisClient } from '@/server/storage/redisConnection';
import { performResearchAnalysis } from '../researchAnalysis';

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    isRunning: jest.fn().mockReturnValue(false),
    run: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}));

jest.mock('@/server/storage/redis', () => ({
  storage: {
    del: jest.fn(),
    hset: jest.fn(),
    setex: jest.fn(),
  },
}));

jest.mock('@/server/storage/redisConnection');

jest.mock('../researchAnalysis', () => ({
  performResearchAnalysis: jest.fn().mockResolvedValue({
    papers: [],
    paperCount: 0,
    institutionCount: 0,
    categoryCount: {},
    analysis: 'Mock analysis',
  }),
}));

describe('startRadarWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockReturnValue({ host: 'localhost', port: 6379 });
  });

  it('should start worker successfully', async () => {
    await expect(startRadarWorker()).resolves.toBeUndefined();

     waitFor(() => {
      expect(storage.hset).toHaveBeenCalledWith(/radar-job/);
    });
  });

  it('should handle Redis unavailable', async () => {
    (getRedisClient as jest.Mock).mockImplementation(() => {
      throw new Error('Redis not available');
    });

    await expect(startRadarWorker()).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      'Redis not available — skipping RADAR worker startup.'
    );
  });

  it('should pass the job userGroupId through to performResearchAnalysis', async () => {
    await startRadarWorker();

    const processor = (Worker as unknown as jest.Mock).mock.calls[0][1];
    await processor({
      data: {
        agentId: 'agent-1',
        jobId: 'job-1',
        userId: 'user-1',
        userGroupId: 'group-1',
        dateStart: '2024-01-01',
        dateEnd: '2024-12-31',
        model: 'model-1',
        categories: [],
        institutions: [],
        searchHash: 'hash-1',
      },
    });

    expect(performResearchAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: 'group-1' })
    );
  });
});
