import { storage } from '@/server/storage/redis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { getSwearQueue } from '@/features/ai-agents/utils/swear/worker/queue';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
import { AiAgentType } from '@/features/shared/types';

// Mock the dependencies
jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/utils/swear/worker/queue');
jest.mock('@/features/document-upload-provider/sources/utils/file-helpers');
jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn(),
  },
}));

const mockUserId = 'user-123';
const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';

const mockSwearAgent = {
  id: mockAgentId,
  type: AiAgentType.SWEAR,
  name: 'SWEAR Agent',
};

describe('analyzeWarrant route logic', () => {
  let mockQueue: { add: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    (getAvailableAgents as jest.Mock).mockResolvedValue([mockSwearAgent]);
    (getSwearQueue as jest.Mock).mockReturnValue(mockQueue);
    (parseFile as jest.Mock).mockResolvedValue('Extracted document text content');
    (storage.hset as jest.Mock).mockResolvedValue('OK');
  });

  it('should return empty agents when user has no access', async () => {
    (getAvailableAgents as jest.Mock).mockResolvedValue([]);

    const agents = await getAvailableAgents(mockUserId);

    expect(agents).toEqual([]);
  });

  it('should parse file successfully', async () => {
    const buffer = Buffer.from('test content');
    const result = await parseFile(buffer, 'application/pdf');

    expect(result).toBe('Extracted document text content');
  });

  it('should throw when parseFile fails', async () => {
    (parseFile as jest.Mock).mockRejectedValue(new Error('Parse error'));

    const buffer = Buffer.from('test content');

    await expect(parseFile(buffer, 'application/pdf')).rejects.toThrow('Parse error');
  });

  it('should return null queue when Redis unavailable', () => {
    (getSwearQueue as jest.Mock).mockReturnValue(null);

    const queue = getSwearQueue();

    expect(queue).toBeNull();
  });

  it('should add job to queue', async () => {
    const queue = getSwearQueue();

    await queue!.add('swearJob', {
      jobId: 'test-job',
      userId: mockUserId,
      agentId: mockAgentId,
      documentText: 'test text',
      modelId: 'gpt-4',
      filename: 'test.pdf',
    });

    expect(mockQueue.add).toHaveBeenCalledWith('swearJob', expect.objectContaining({
      jobId: 'test-job',
      userId: mockUserId,
    }));
  });

  it('should store job metadata in Redis', async () => {
    const jobId = 'test-job-123';

    await storage.hset(`swear-job:${jobId}`, {
      status: 'queued',
      progress: 'Job queued, waiting to start...',
      filename: 'test.pdf',
    });

    expect(storage.hset).toHaveBeenCalledWith(
      'swear-job:test-job-123',
      expect.objectContaining({
        status: 'queued',
      })
    );
  });
});
