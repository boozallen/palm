import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { getResearchJobStatus } from './get-research-job-status';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/server/storage/redis');

jest.mock('@/features/shared/dal/getAvailableAgents');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

const testRouter = router({
  getResearchJobStatus,
});

describe('getResearchJobStatus', () => {
  let mockCtx: ContextType;
  const jobId = 'test-research-job-id';
  const agentId = '7365c7c3-d10f-48cb-bfbc-0c2566f29599';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.RADAR }]);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getResearchJobStatus({ agentId, jobId })).rejects.toThrow(
      'You do not have permission to access this resource.'
    );

    expect(storage.hset).not.toHaveBeenCalled();
  });

  it('should retrieve job status from Redis', async () => {
    const mockJob = {
      status: 'completed',
      progress: 'Research analysis complete!',
      created: '1704067200000',
      error: null,
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getResearchJobStatus({ agentId, jobId });

    expect(storage.hgetall).toHaveBeenCalledWith(`research-job:${jobId}`);
    expect(result).toEqual({
      status: 'completed',
      progress: 'Research analysis complete!',
      created: '1704067200000',
      error: null,
    });
  });

  it('should retrieve job status with error from Redis', async () => {
    const mockJob = {
      status: 'failed',
      progress: 'Error occurred during research',
      created: '1704067200000',
      error: 'Connection timeout',
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getResearchJobStatus({ agentId, jobId });

    expect(result).toEqual({
      status: 'failed',
      progress: 'Error occurred during research',
      created: '1704067200000',
      error: 'Connection timeout',
    });
  });

  it('should throw an error if job is not found', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({});

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getResearchJobStatus({ agentId, jobId })).rejects.toThrow(
      'Job not found'
    );
  });

  it('should handle job without error field', async () => {
    const mockJob = {
      status: 'processing',
      progress: 'Analyzing data...',
      created: '1704067200000',
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getResearchJobStatus({ agentId, jobId });

    expect(result).toEqual({
      status: 'processing',
      progress: 'Analyzing data...',
      created: '1704067200000',
      error: null,
    });
  });
});
