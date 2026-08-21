import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import {
  enqueueConversationGraphBackfill,
  enqueueConversationGraphSync,
} from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { getRedisClient } from '@/server/storage/redisConnection';
import { logger } from '@/server/logger';

const mockQueueAdd = jest.fn();

jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));
jest.mock('@/server/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));
jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: mockQueueAdd })),
}));

describe('conversationGraphQueue', () => {
  const data = {
    chatId: 'chat-1',
    messageIds: ['message-1'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockReset();
    mockQueueAdd.mockResolvedValue(undefined);
  });

  it('resolves without throwing when Redis is unavailable', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    (getRedisClient as jest.Mock).mockImplementation(() => {
      throw new Error('Redis unavailable');
    });

    await expect(enqueueConversationGraphSync(data)).resolves.toBeUndefined();
    await expect(enqueueConversationGraphBackfill(data)).rejects.toThrow(
      'Error enqueueing conversation graph sync',
    );
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('does not enqueue when the toggle is off', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);

    await enqueueConversationGraphSync(data);

    expect(getRedisClient).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('does not enqueue for an empty message list', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);

    await enqueueConversationGraphSync({ chatId: 'chat-1', messageIds: [] });

    expect(getRedisClient).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Conversation graph sync not enqueued for empty message list',
      { chatId: 'chat-1' },
    );
  });

  it('enqueues a sync job', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    (getRedisClient as jest.Mock).mockReturnValue({});

    await enqueueConversationGraphSync(data);

    expect(mockQueueAdd).toHaveBeenCalledWith('sync', data);
  });

  it('enqueues a required opt-in backfill', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    (getRedisClient as jest.Mock).mockReturnValue({});

    await enqueueConversationGraphBackfill(data);

    expect(mockQueueAdd).toHaveBeenCalledWith('sync', data);
  });

  it('rejects a required opt-in backfill when adding the job fails', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    (getRedisClient as jest.Mock).mockReturnValue({});
    mockQueueAdd.mockRejectedValue(new Error('Redis write failed'));

    await expect(enqueueConversationGraphBackfill(data)).rejects.toThrow(
      'Error enqueueing conversation graph sync',
    );
  });
});
