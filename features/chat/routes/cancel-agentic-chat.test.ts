import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';

jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@/features/chat/utils/worker/queue', () => ({
  getChatQueue: jest.fn(),
}));

jest.mock('@/features/chat/dal/cancelChatMessage', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import chatRouter from '@/features/chat/routes';
import { getRedisClient } from '@/server/storage/redisConnection';
import { getChatQueue } from '@/features/chat/utils/worker/queue';
import cancelChatMessage from '@/features/chat/dal/cancelChatMessage';

describe('cancel-agentic-chat', () => {
  const mockJobId = '550e8400-e29b-41d4-a716-446655440001';
  const mockMessageId = '550e8400-e29b-41d4-a716-446655440003';
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
    data: { userId: mockUserId, messageId: mockMessageId },
    getState: jest.fn(),
    remove: jest.fn(),
  };

  const mockQueue = {
    getJob: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
    (getChatQueue as jest.Mock).mockReturnValue(mockQueue);
    (cancelChatMessage as jest.Mock).mockResolvedValue(undefined);
  });

  it('should successfully cancel a waiting job', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('waiting');
    mockJob.remove.mockResolvedValue(undefined);

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelAgenticChat({ jobId: mockJobId });

    expect(result).toEqual({ success: true, message: 'Job cancellation initiated' });
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      `chat-job:cancel:${mockJobId}`,
      600,
      '1',
    );
    expect(mockJob.remove).toHaveBeenCalled();
    expect(cancelChatMessage).toHaveBeenCalledWith(mockMessageId);
  });

  it('should set cancellation flag for an active job without removing from queue', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('active');

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelAgenticChat({ jobId: mockJobId });

    expect(result).toEqual({ success: true, message: 'Job cancellation initiated' });
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      `chat-job:cancel:${mockJobId}`,
      600,
      '1',
    );
    expect(mockJob.remove).not.toHaveBeenCalled();
    expect(cancelChatMessage).not.toHaveBeenCalled();
  });

  it('should handle job not found in queue', async () => {
    mockQueue.getJob.mockResolvedValue(null);

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelAgenticChat({ jobId: mockJobId });

    expect(result).toEqual({ success: true, message: 'Job cancellation initiated' });
    expect(mockRedisClient.setex).not.toHaveBeenCalled();
  });

  it('should throw when queue is not available', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    (getChatQueue as jest.Mock).mockReturnValue(null);

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelAgenticChat({ jobId: mockJobId })).rejects.toThrow(
      'Chat queue not available',
    );
  });

  it('should throw Forbidden when job belongs to a different user', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue({
      data: { userId: 'different-user-id', messageId: mockMessageId },
      getState: jest.fn(),
      remove: jest.fn(),
    });

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelAgenticChat({ jobId: mockJobId })).rejects.toThrow();
  });

  it('should handle delayed job by removing it', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('delayed');
    mockJob.remove.mockResolvedValue(undefined);

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.cancelAgenticChat({ jobId: mockJobId });

    expect(result).toEqual({ success: true, message: 'Job cancellation initiated' });
    expect(mockJob.remove).toHaveBeenCalled();
    expect(cancelChatMessage).toHaveBeenCalledWith(mockMessageId);
  });

  it('should throw when Redis operation fails', async () => {
    mockQueue.getJob.mockResolvedValue(mockJob);
    mockJob.getState.mockResolvedValue('active');
    mockRedisClient.setex.mockRejectedValue(new Error('Redis connection failed'));

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelAgenticChat({ jobId: mockJobId })).rejects.toThrow(
      'Redis connection failed',
    );
  });

  it('should validate input schema — rejects non-string jobId', async () => {
    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelAgenticChat({ jobId: 123 } as never)).rejects.toThrow();
  });

  it('should validate input schema — rejects missing jobId', async () => {
    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.cancelAgenticChat({} as never)).rejects.toThrow();
  });
});
