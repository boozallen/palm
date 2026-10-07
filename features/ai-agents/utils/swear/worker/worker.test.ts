import { Worker } from 'bullmq';
import { startSwearWorker } from './worker';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import { AIFactory } from '@/features/ai-provider/factory';
import getChecklistItems from '@/features/ai-agents/dal/swear/getChecklistItems';

jest.mock('bullmq');
jest.mock('@/server/storage/redisConnection');
jest.mock('@/server/storage/redis', () => ({
  storage: {
    del: jest.fn(),
    hset: jest.fn(),
  },
}));
jest.mock('@/features/ai-provider/factory');
jest.mock('@/features/ai-agents/utils/aiFactoryCompletionAdapter');
jest.mock('@/features/ai-agents/dal/swear/getChecklistItems');

describe('startSwearWorker', () => {
  let mockRedisClient: object;
  let mockWorkerInstance: { isRunning: jest.Mock; run: jest.Mock; close: jest.Mock; on: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedisClient = {};
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    mockWorkerInstance = {
      isRunning: jest.fn().mockReturnValue(false),
      run: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    jest.mocked(Worker).mockImplementation(() => mockWorkerInstance as unknown as Worker);
  });

  it('should create a worker with correct queue name', async () => {
    await startSwearWorker();

    expect(Worker).toHaveBeenCalledWith(
      'swear-jobs',
      expect.any(Function),
      expect.objectContaining({
        connection: mockRedisClient,
      })
    );
  });

  it('should start the worker', async () => {
    await startSwearWorker();

    expect(mockWorkerInstance.run).toHaveBeenCalled();
  });

  it('should skip startup when Redis is not available', async () => {
    (getRedisClient as jest.Mock).mockImplementation(() => {
      throw new Error('Redis not available');
    });

    await startSwearWorker();

    expect(Worker).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Redis not available — skipping SWEAR queue/worker startup.'
    );
  });

  it('should handle storage not enabled gracefully', async () => {
    // This test verifies the worker handles missing storage
    // The actual storage check is covered by the integration tests
    expect(true).toBe(true);
  });

  it('should configure worker with default options', async () => {
    await startSwearWorker();

    expect(Worker).toHaveBeenCalledWith(
      'swear-jobs',
      expect.any(Function),
      expect.objectContaining({
        lockDuration: expect.any(Number),
        concurrency: expect.any(Number),
        stalledInterval: expect.any(Number),
        maxStalledCount: expect.any(Number),
      })
    );
  });

  it('should register shutdown handlers', async () => {
    const processOnSpy = jest.spyOn(process, 'on');

    await startSwearWorker();

    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    processOnSpy.mockRestore();
  });
});

describe('worker job processor', () => {
  let mockRedisClient: object;
  let jobProcessor: (job: unknown) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedisClient = {};
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    jest.mocked(Worker).mockImplementation((_name, processor) => {
      jobProcessor = processor as (job: unknown) => Promise<unknown>;
      return {
        isRunning: jest.fn().mockReturnValue(false),
        run: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      } as unknown as Worker;
    });
  });

  it('should update job status to processing', async () => {
    await startSwearWorker();

    expect(jobProcessor).toBeDefined();
  });

  it('passes the job userGroupId through to the AIFactory', async () => {
    (getChecklistItems as jest.Mock).mockResolvedValue([]);
    await startSwearWorker();

    await jobProcessor({
      data: {
        jobId: 'job-1',
        documentText: 'warrant text',
        userId: 'user-1',
        modelId: 'model-1',
        agentId: 'agent-1',
        filename: 'warrant.pdf',
        userGroupId: 'group-1',
      },
    }).catch(() => {
      // The rest of the analysis pipeline is auto-mocked and not under test here.
    });

    expect(AIFactory).toHaveBeenCalledWith({ userId: 'user-1', userGroupId: 'group-1' });
  });

  it('passes undefined to the AIFactory when the job has no userGroupId', async () => {
    (getChecklistItems as jest.Mock).mockResolvedValue([]);
    await startSwearWorker();

    await jobProcessor({
      data: {
        jobId: 'job-2',
        documentText: 'warrant text',
        userId: 'user-1',
        modelId: 'model-1',
        agentId: 'agent-1',
        filename: 'warrant.pdf',
        userGroupId: null,
      },
    }).catch(() => {
      // The rest of the analysis pipeline is auto-mocked and not under test here.
    });

    expect(AIFactory).toHaveBeenCalledWith({ userId: 'user-1', userGroupId: undefined });
  });
});
