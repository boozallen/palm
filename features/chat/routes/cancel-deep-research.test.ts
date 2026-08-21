import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';

jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@/features/ai-provider/sources/deep-research/deepResearchQueue', () => ({
  getDeepResearchQueue: jest.fn(),
}));

import chatRouter from '@/features/chat/routes';
import { getRedisClient } from '@/server/storage/redisConnection';
import { getDeepResearchQueue } from '@/features/ai-provider/sources/deep-research/deepResearchQueue';

describe('cancel-deep-research', () => {
  const mockJobId = '550e8400-e29b-41d4-a716-446655440001';
  const mockUserId = '550e8400-e29b-41d4-a716-446655440002';

  const mockUserContext = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
  } as unknown as ContextType;

  const mockRedisClient = {
    setex: jest.fn(),
  };

  const mockJob = {
    getState: jest.fn(),
    remove: jest.fn(),
  };

  const mockQueue = {
    getJob: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
    (getDeepResearchQueue as jest.Mock).mockReturnValue(mockQueue);
  });

  it('should successfully cancel a waiting job', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('waiting');
    mockJob.remove.mockResolvedValue(undefined);

    const input = { jobId: mockJobId };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelDeepResearch(input);

    expect(result).toEqual({ 
      success: true, 
      message: 'Job cancellation initiated',
    });
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      `deep-research:cancel:${mockJobId}`, 
      600, 
      '1'
    );
    expect(mockJob.remove).toHaveBeenCalled();
  });

  it('should set cancellation flag for active job without removing from queue', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('active');

    const input = { jobId: mockJobId };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelDeepResearch(input);

    expect(result).toEqual({ 
      success: true, 
      message: 'Job cancellation initiated',
    });
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      `deep-research:cancel:${mockJobId}`, 
      600, 
      '1'
    );
    expect(mockJob.remove).not.toHaveBeenCalled();
  });

  it('should handle job not found in queue', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(null);

    const input = { jobId: mockJobId };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelDeepResearch(input);

    expect(result).toEqual({ 
      success: true, 
      message: 'Job cancellation initiated',
    });
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      `deep-research:cancel:${mockJobId}`, 
      600, 
      '1'
    );
  });

  it('should handle queue not available', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    (getDeepResearchQueue as jest.Mock).mockReturnValue(null);

    const input = { jobId: mockJobId };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelDeepResearch(input);

    expect(result).toEqual({ 
      success: true, 
      message: 'Job cancellation initiated',
    });
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      `deep-research:cancel:${mockJobId}`, 
      600, 
      '1'
    );
  });

  it('should handle delayed job by removing it', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('delayed');
    mockJob.remove.mockResolvedValue(undefined);

    const input = { jobId: mockJobId };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelDeepResearch(input);

    expect(result).toEqual({ 
      success: true, 
      message: 'Job cancellation initiated',
    });
    expect(mockJob.remove).toHaveBeenCalled();
  });

  it('should throw error when Redis operation fails', async () => {
    mockRedisClient.setex.mockRejectedValue(new Error('Redis connection failed'));

    const input = { jobId: mockJobId };

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelDeepResearch(input)).rejects.toThrow('Failed to cancel deep research job');
  });

  it('should handle job removal failure gracefully', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('waiting');
    mockJob.remove.mockRejectedValue(new Error('Failed to remove job'));

    const input = { jobId: mockJobId };

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelDeepResearch(input)).rejects.toThrow('Failed to cancel deep research job');
  });

  it('should validate input schema', async () => {
    const input = { jobId: 123 }; // Invalid type

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelDeepResearch(input as any)).rejects.toThrow();
  });

  it('should require jobId in input', async () => {
    const input = {}; // Missing jobId

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelDeepResearch(input as any)).rejects.toThrow();
  });
});