const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn();
const mockWorkerIsRunning = jest.fn(() => true);

jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/features/graph-database/services/syncConversationGraph', () => ({
  syncConversationGraph: jest.fn(),
}));
jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));
jest.mock('bullmq', () => ({
  Worker: jest.fn(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
    isRunning: mockWorkerIsRunning,
  })),
}));

describe('conversationGraphWorker', () => {
  // The worker/workerStarted singleton state lives at module scope, so each
  // test needs a fresh module instance. Every mocked dependency is
  // re-required here too — a stale top-level import would point at a
  // different mock instance than the one the freshly-loaded module actually
  // calls.
  const loadModule = () => {
    jest.resetModules();
    const { Worker } = require('bullmq');
    const { isMemoryEnabled } = require('@/features/graph-database/utils/isMemoryEnabled');
    const { syncConversationGraph } = require('@/features/graph-database/services/syncConversationGraph');
    const { getRedisClient } = require('@/server/storage/redisConnection');
    const { startConversationGraphWorker } = require('@/features/graph-database/utils/worker/conversationGraphWorker');
    return { Worker, isMemoryEnabled, syncConversationGraph, getRedisClient, startConversationGraphWorker };
  };

  beforeEach(() => {
    mockWorkerOn.mockClear();
    mockWorkerClose.mockClear();
    mockWorkerIsRunning.mockClear().mockReturnValue(true);
  });

  it('registers a conversation-graph worker regardless of the toggle state', async () => {
    const { Worker, isMemoryEnabled, getRedisClient, startConversationGraphWorker } = loadModule();
    (getRedisClient as jest.Mock).mockReturnValue({});
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);

    await startConversationGraphWorker();

    expect(Worker).toHaveBeenCalledWith(
      'conversation-graph',
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 }),
    );
  });

  it('does not construct a worker when Redis is unavailable', async () => {
    const { Worker, getRedisClient, startConversationGraphWorker } = loadModule();
    (getRedisClient as jest.Mock).mockImplementation(() => {
      throw new Error('Redis unavailable');
    });

    await startConversationGraphWorker();

    expect(Worker).not.toHaveBeenCalled();
  });

  it('processor no-ops for a sync job when the toggle is off', async () => {
    const { Worker, isMemoryEnabled, syncConversationGraph, getRedisClient, startConversationGraphWorker } = loadModule();
    (getRedisClient as jest.Mock).mockReturnValue({});
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);

    await startConversationGraphWorker();
    const processor = (Worker as jest.Mock).mock.calls[0][1];
    await processor({ name: 'sync', data: { chatId: 'chat-1', messageIds: ['message-1'] } });

    expect(syncConversationGraph).not.toHaveBeenCalled();
  });

  it('processor runs the sync for a sync job when the toggle is on', async () => {
    const { Worker, isMemoryEnabled, syncConversationGraph, getRedisClient, startConversationGraphWorker } = loadModule();
    (getRedisClient as jest.Mock).mockReturnValue({});
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);

    await startConversationGraphWorker();
    const processor = (Worker as jest.Mock).mock.calls[0][1];
    await processor({ name: 'sync', data: { chatId: 'chat-1', messageIds: ['message-1'] } });

    expect(syncConversationGraph).toHaveBeenCalledWith({
      chatId: 'chat-1',
      messageIds: ['message-1'],
    });
  });

  it('throws for an unsupported job name when the toggle is on', async () => {
    const { Worker, isMemoryEnabled, getRedisClient, startConversationGraphWorker } = loadModule();
    (getRedisClient as jest.Mock).mockReturnValue({});
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);

    await startConversationGraphWorker();
    const processor = (Worker as jest.Mock).mock.calls[0][1];

    await expect(processor({ name: 'unknown', data: { chatId: 'chat-1' } })).rejects.toThrow(
      'Unsupported conversation graph job',
    );
  });
});
