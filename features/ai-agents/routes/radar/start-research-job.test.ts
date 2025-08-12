import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { startResearchJob } from './start-research-job';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    randomUUID: jest.fn().mockReturnValue('mock-research-job-id'),
  };
});

jest.mock('@/server/storage/redis');

const mockAdd = jest.fn();

jest.mock('@/features/ai-agents/utils/radar/researchQueue', () => ({
  getResearchQueue: () => ({
    add: mockAdd,
  }),
}));

jest.mock('@/features/shared/dal/getAvailableAgents');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

const testRouter = router({
  startResearchJob,
});

describe('startResearchJob', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    dateStart: '2024-01-01',
    dateEnd: '2024-12-31',
    model: '123e4567-e89b-12d3-a456-426614174000',
    categories: ['Machine Learning', 'Computer Science'],
    institutions: ['Stanford University', 'MIT'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([{ id: mockInput.agentId, type: AiAgentType.RADAR }]);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startResearchJob(mockInput)).rejects.toThrow(
      'You do not have permission to access this resource.'
    );

    expect(storage.hset).not.toHaveBeenCalled();
  });

  it('should generate a jobId', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.startResearchJob(mockInput);

    expect(result).toEqual({ jobId: 'mock-research-job-id' });
  });

  it('should set job status in Redis', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startResearchJob(mockInput);

    expect(storage.hset).toHaveBeenCalledWith(
      'research-job:mock-research-job-id',
      {
        status: 'processing',
        created: expect.any(Number),
        progress: 'Initializing research...',
        searchHash: expect.any(String),
      }
    );
  });

  it('should add job to research queue', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startResearchJob(mockInput);

    expect(mockAdd).toHaveBeenCalledWith('researchJob', {
      ...mockInput,
      jobId: 'mock-research-job-id',
      userId: mockCtx.userId,
      searchHash: expect.any(String),
    });
  });
});
