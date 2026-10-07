import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { getRcastStatus } from './get-rcast-status';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/server/storage/redis');
jest.mock('@/features/shared/dal/getAvailableAgents');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

const testRouter = router({
  getRcastStatus,
});

describe('getRcastStatus', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    jobId: 'mock-job-id',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.RCAST },
    ]);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRcastStatus(mockInput)).rejects.toThrow(
      'You do not have permission to access this resource'
    );

    expect(storage.hgetall).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.CERTA },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRcastStatus(mockInput)).rejects.toThrow(
      'You do not have permission to access this resource'
    );
  });

  it('should query Redis using the rcast-job key prefix', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'processing',
      progress: '50%',
      created: '2024-01-01T00:00:00Z',
    });

    const caller = testRouter.createCaller(mockCtx);

    await caller.getRcastStatus(mockInput);

    expect(storage.hgetall).toHaveBeenCalledWith('rcast-job:mock-job-id');
  });

  it('should throw if job not found', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({});

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getRcastStatus(mockInput)).rejects.toThrow(
      'Job not found'
    );
  });

  it('should return job status for processing job', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'processing',
      progress: 'Processing labor categories',
      created: '2024-01-01T00:00:00Z',
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getRcastStatus(mockInput);

    expect(result).toEqual({
      status: 'processing',
      progress: 'Processing labor categories',
      created: '2024-01-01T00:00:00Z',
      completed: null,
      error: null,
    });
  });

  it('should return job status for completed job', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'completed',
      progress: 'Complete',
      created: '2024-01-01T00:00:00Z',
      completed: '2024-01-01T00:05:00Z',
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getRcastStatus(mockInput);

    expect(result).toEqual({
      status: 'completed',
      progress: 'Complete',
      created: '2024-01-01T00:00:00Z',
      completed: '2024-01-01T00:05:00Z',
      error: null,
    });
  });

  it('should return job status for failed job', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'failed',
      progress: 'Failed',
      created: '2024-01-01T00:00:00Z',
      error: 'Processing error occurred',
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getRcastStatus(mockInput);

    expect(result).toEqual({
      status: 'failed',
      progress: 'Failed',
      created: '2024-01-01T00:00:00Z',
      completed: null,
      error: 'Processing error occurred',
    });
  });
});
