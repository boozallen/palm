import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

// Mock the dependencies
jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/server/storage/redis', () => ({
  storage: {
    hgetall: jest.fn(),
  },
}));

const mockUserId = 'user-123';
const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
const mockJobId = 'job-123';

const mockSwearAgent = {
  id: mockAgentId,
  type: AiAgentType.SWEAR,
  name: 'SWEAR Agent',
};

describe('getSwearStatus route logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAvailableAgents as jest.Mock).mockResolvedValue([mockSwearAgent]);
  });

  it('should return queued status from Redis', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'queued',
      progress: 'Job queued, waiting to start...',
    });

    const jobData = await storage.hgetall(`swear-job:${mockJobId}`);

    expect(jobData).toEqual({
      status: 'queued',
      progress: 'Job queued, waiting to start...',
    });
  });

  it('should return processing status from Redis', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'processing',
      progress: 'Analyzing warrant...',
    });

    const jobData = await storage.hgetall(`swear-job:${mockJobId}`);

    expect(jobData).toEqual({
      status: 'processing',
      progress: 'Analyzing warrant...',
    });
  });

  it('should return completed status with results', async () => {
    const mockResults = {
      analysis: 'Analysis content',
      filename: 'test-warrant.pdf',
    };

    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'completed',
      progress: 'Analysis complete!',
      results: JSON.stringify(mockResults),
    });

    const jobData = await storage.hgetall(`swear-job:${mockJobId}`);

    expect(jobData?.status).toBe('completed');
    expect(JSON.parse(jobData?.results as string)).toEqual(mockResults);
  });

  it('should return error status', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue({
      status: 'error',
      error: 'Something went wrong',
    });

    const jobData = await storage.hgetall(`swear-job:${mockJobId}`);

    expect(jobData).toEqual({
      status: 'error',
      error: 'Something went wrong',
    });
  });

  it('should return null when job not found', async () => {
    (storage.hgetall as jest.Mock).mockResolvedValue(null);

    const jobData = await storage.hgetall(`swear-job:${mockJobId}`);

    expect(jobData).toBeNull();
  });

  it('should verify user has access to SWEAR agent', async () => {
    const agents = await getAvailableAgents(mockUserId);
    const agent = agents.find(
      (a: { id: string; type: AiAgentType }) => a.id === mockAgentId && a.type === AiAgentType.SWEAR
    );

    expect(agent).toBeDefined();
    expect(agent?.type).toBe(AiAgentType.SWEAR);
  });

  it('should not find agent when user has no access', async () => {
    (getAvailableAgents as jest.Mock).mockResolvedValue([]);

    const agents = await getAvailableAgents(mockUserId);
    const agent = agents.find(
      (a: { id: string; type: AiAgentType }) => a.id === mockAgentId && a.type === AiAgentType.SWEAR
    );

    expect(agent).toBeUndefined();
  });
});
