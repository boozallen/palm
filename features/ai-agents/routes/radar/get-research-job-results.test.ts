import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { getResearchJobResults } from './get-research-job-results';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/server/storage/redis');

jest.mock('@/features/shared/dal/getAvailableAgents');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

const testRouter = router({
  getResearchJobResults,
});

describe('getResearchJobResults', () => {
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

    await expect(caller.getResearchJobResults({ agentId, jobId })).rejects.toThrow(
      'You do not have permission to access this resource.'
    );

    expect(storage.hset).not.toHaveBeenCalled();
  });

  it('should retrieve job results from Redis when completed', async () => {
    const mockResults = { papers: [], paperCount: 0 };
    const mockJob = {
      status: 'completed',
      results: JSON.stringify(mockResults),
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getResearchJobResults({ agentId, jobId });

    expect(storage.hgetall).toHaveBeenCalledWith(`research-job:${jobId}`);
    expect(result).toEqual(mockResults);
  });

  it('should return null when results field is empty', async () => {
    const mockJob = {
      status: 'completed',
      results: null,
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getResearchJobResults({ agentId, jobId });

    expect(result).toBeNull();
  });

  it('should return null when results field is undefined', async () => {
    const mockJob = {
      status: 'completed',
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getResearchJobResults({ agentId, jobId });

    expect(result).toBeNull();
  });

  it('should throw error when job is not completed', async () => {
    const mockJob = {
      status: 'processing',
      progress: 'Still working...',
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getResearchJobResults({ agentId, jobId })).rejects.toThrow(
      'Job not completed'
    );
  });

  it('should throw error when job is failed', async () => {
    const mockJob = {
      status: 'failed',
      error: 'Something went wrong',
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getResearchJobResults({ agentId, jobId })).rejects.toThrow(
      'Job not completed'
    );
  });

  it('should handle complex results data', async () => {
    const mockResults = {
      papers: [
        { title: 'Test Paper 1', authors: ['Author 1'] },
        { title: 'Test Paper 2', authors: ['Author 2', 'Author 3'] },
      ],
      paperCount: 2,
      metadata: { searchQuery: 'machine learning', totalResults: 150 },
    };
    const mockJob = {
      status: 'completed',
      results: JSON.stringify(mockResults),
    };

    (storage.hgetall as jest.Mock).mockResolvedValue(mockJob);

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getResearchJobResults({ agentId, jobId });

    expect(result).toEqual(mockResults);
  });
});
