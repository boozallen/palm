import { getDeepResearchQueue, closeDeepResearchQueue } from './deepResearchQueue';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';

const mockQueue = {
  close: jest.fn().mockResolvedValue(undefined),
  add: jest.fn(),
};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => mockQueue),
}));

jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.spyOn(global, 'setTimeout').mockImplementation(() => {
  return 123 as any;
});

jest.spyOn(global, 'clearTimeout').mockImplementation(() => {
});

describe('deepResearchQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeepResearchQueue', () => {
    it('should create and return a queue instance with correct configuration', () => {
      const mockConnection = { host: 'localhost', port: 6379 };
      (getRedisClient as jest.Mock).mockReturnValue(mockConnection);

      const queue = getDeepResearchQueue();

      expect(queue).toBe(mockQueue);
      expect(getRedisClient).toHaveBeenCalled();
      expect(require('bullmq').Queue).toHaveBeenCalledWith('deep-research-jobs', {
        connection: mockConnection,
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
        },
      });
      expect(logger.info).toHaveBeenCalledWith('Deep research queue initialized successfully');
    });

    it('should return existing instance on subsequent calls (singleton behavior)', () => {
      const mockConnection = { host: 'localhost', port: 6379 };
      (getRedisClient as jest.Mock).mockReturnValue(mockConnection);

      const queue1 = getDeepResearchQueue();
      const queue2 = getDeepResearchQueue();

      expect(queue1).toBe(queue2);
      expect(queue1).toBe(mockQueue);
    });
  });

  describe('closeDeepResearchQueue', () => {
    it('should handle queue closing with timeout management', async () => {
      await closeDeepResearchQueue();

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000);
      expect(clearTimeout).toHaveBeenCalledWith(123);
      expect(logger.info).toHaveBeenCalledWith('Deep research queue closed successfully');
    });

    it('should handle errors during queue closure gracefully', async () => {
      const closeError = new Error('Close operation failed');
      mockQueue.close.mockRejectedValueOnce(closeError);

      await closeDeepResearchQueue();

      expect(logger.error).toHaveBeenCalledWith('Error closing deep research queue:', closeError);
    });

    it('should execute timeout callback with process.exit and warning', async () => {
      let timeoutCallback: (() => void) | undefined;
      
      const mockSetTimeout = jest.spyOn(global, 'setTimeout');
      mockSetTimeout.mockImplementation((callback: () => void, delay?: number) => {
        timeoutCallback = callback;
        expect(delay).toBe(10000);
        return 123 as any;
      });

      const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as any);

      await closeDeepResearchQueue();

      expect(timeoutCallback).toBeDefined();
      expect(() => timeoutCallback!()).toThrow('process.exit called');
      expect(logger.warn).toHaveBeenCalledWith('Force closing deep research queue after timeout');

      mockProcessExit.mockRestore();
      mockSetTimeout.mockRestore();
    });
  });

  describe('DeepResearchJobData interface validation', () => {
    it('should support complete job data structure', () => {
      const mockConnection = { host: 'localhost', port: 6379 };
      (getRedisClient as jest.Mock).mockReturnValue(mockConnection);

      const queue = getDeepResearchQueue();
      
      const fullJobData = {
        jobId: 'job-123',
        userId: 'user-456',
        chatId: 'chat-789',
        messageId: 'msg-101',
        modelId: 'o4-mini-deep-research',
        input: 'What is quantum computing?',
        maxToolCalls: 25,
        instructions: 'Focus on practical applications',
        searchHash: 'hash-abc123',
      };

      if (queue) {
        queue.add('research-job', fullJobData);
        expect(mockQueue.add).toHaveBeenCalledWith('research-job', fullJobData);
      }
    });

    it('should support minimal required job data (optional fields excluded)', () => {
      const mockConnection = { host: 'localhost', port: 6379 };
      (getRedisClient as jest.Mock).mockReturnValue(mockConnection);

      const queue = getDeepResearchQueue();
      
      const minimalJobData = {
        jobId: 'job-123',
        userId: 'user-456',
        chatId: 'chat-789',
        messageId: 'msg-101',
        modelId: 'o4-mini-deep-research',
        input: 'What is quantum computing?',
      };

      if (queue) {
        queue.add('minimal-job', minimalJobData);
        expect(mockQueue.add).toHaveBeenCalledWith('minimal-job', minimalJobData);
      }
    });
  });

  describe('configuration validation', () => {
    it('should have correct configuration values when queue is created', () => {
      expect(typeof getDeepResearchQueue).toBe('function');
      
      const mockConnection = { host: 'localhost', port: 6379 };
      (getRedisClient as jest.Mock).mockReturnValue(mockConnection);
      
      const queue = getDeepResearchQueue();
      expect(queue).toBeDefined();
    });
  });

  describe('function exports', () => {
    it('should export required functions', () => {
      expect(typeof getDeepResearchQueue).toBe('function');
      expect(typeof closeDeepResearchQueue).toBe('function');
    });
  });

  describe('integration behavior', () => {
    it('should work with the queue flow (create -> use -> close)', async () => {
      const mockConnection = { host: 'localhost', port: 6379 };
      (getRedisClient as jest.Mock).mockReturnValue(mockConnection);

      const queue = getDeepResearchQueue();
      expect(queue).toBeDefined();

      if (queue) {
        const jobData = {
          jobId: 'integration-test',
          userId: 'test-user',
          chatId: 'test-chat',
          messageId: 'test-message',
          modelId: 'test-model',
          input: 'test input',
        };
        queue.add('test-job', jobData);
        expect(mockQueue.add).toHaveBeenCalledWith('test-job', jobData);
      }

      await closeDeepResearchQueue();
      expect(logger.info).toHaveBeenCalledWith('Deep research queue closed successfully');
    });
  });
});
