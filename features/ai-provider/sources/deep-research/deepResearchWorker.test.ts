import { startDeepResearchWorker } from './deepResearchWorker';
import { logger } from '@/server/logger';
import { getRedisClient } from '@/server/storage/redisConnection';
import { AIFactory } from '@/features/ai-provider/factory';
import db from '@/server/db';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';

const mockWorker = {
  isRunning: jest.fn().mockReturnValue(false),
  run: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => mockWorker),
}));

jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatMessage: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ chatId: 'chat-456' }),
    },
  },
}));

jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn(),
}));

jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/features/graph-database/utils/worker/conversationGraphQueue', () => ({
  enqueueConversationGraphSync: jest.fn(),
}));

jest.mock('@/features/chat/dal/updateMessage', () => {
  return jest.fn().mockResolvedValue(undefined);
});

jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions', () => ({
  extractArtifactsFromMessage: jest.fn().mockReturnValue({
    artifacts: [],
    cleanedText: 'test content',
  }),
}));

jest.mock('@/features/chat/utils/followUpQuestionsHelpers', () => ({
  extractFollowUpQuestionsFromMessage: jest.fn().mockReturnValue({
    followUpQuestions: [],
    cleanedText: 'test content',
  }),
}));

const mockAiSource = {
  deepResearch: jest.fn(),
};

describe('deepResearchWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockReturnValue({
      host: 'localhost', 
      port: 6379,
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    });
    (AIFactory as jest.Mock).mockImplementation(() => ({
      buildUserSource: jest.fn().mockResolvedValue({
        source: mockAiSource,
        model: { externalId: 'o4-mini-deep-research' },
      }),
    }));
  });

  describe('startDeepResearchWorker', () => {
    it('should start worker successfully', async () => {
      await expect(startDeepResearchWorker()).resolves.toBeUndefined();
      expect(mockWorker.run).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('DeepResearch worker started successfully');
    });

    it('should handle Redis unavailable', async () => {
      (getRedisClient as jest.Mock).mockImplementation(() => {
        throw new Error('Redis not available');
      });

      await expect(startDeepResearchWorker()).resolves.toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'Redis not available — skipping deep research queue/worker startup.'
      );
    });

    it('should skip if worker is already running', async () => {
      mockWorker.isRunning.mockReturnValueOnce(true);
      
      await expect(startDeepResearchWorker()).resolves.toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'DeepResearch worker is already running, skipping initialization'
      );
    });
  });

  describe('worker job processing', () => {
    let workerCallback: any;

    beforeEach(async () => {
      const Worker = require('bullmq').Worker;
      Worker.mockImplementation((_queueName: string, callback: any) => {
        workerCallback = callback;
        return mockWorker;
      });
      
      // Start the worker to set up the callback
      await startDeepResearchWorker();
    });

    it('should process deep research job successfully', async () => {
      mockAiSource.deepResearch.mockResolvedValue('Deep research content');

      const jobData = {
        jobId: 'test-job-id',
        userId: 'user-123',
        chatId: 'chat-456',
        messageId: 'msg-789',
        modelId: 'o4-mini-deep-research',
        input: 'Test input',
        instructions: 'Test instructions',
        maxToolCalls: 10,
      };

      const result = await workerCallback({
        data: jobData,
      });

      expect(result).toEqual({ content: 'test content' });
      expect(AIFactory).toHaveBeenCalled();
      expect(mockAiSource.deepResearch).toHaveBeenCalledWith(
        'Test input',
        'Test instructions',
        10,
        'test-job-id'
      );
      
      // Status should remain as pending during processing (no longer updating to 'active')
      expect(db.chatMessage.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deepResearchStatus: 'active' },
        })
      );
    });

    it('should handle model without deep research support', async () => {
      // Mock AI source without deepResearch method
      const mockAiSourceWithoutDeepResearch = {};
      (AIFactory as jest.Mock).mockImplementation(() => ({
        buildUserSource: jest.fn().mockResolvedValue({
          source: mockAiSourceWithoutDeepResearch,
          model: { externalId: 'gpt-3.5-turbo' },
        }),
      }));

      const jobData = {
        jobId: 'test-job-id',
        userId: 'user-123',
        chatId: 'chat-456',
        messageId: 'msg-789',
        modelId: 'gpt-3.5-turbo',
        input: 'Test input',
        instructions: 'Test instructions',
        maxToolCalls: 10,
      };

      await expect(workerCallback({
        data: jobData,
      })).rejects.toThrow('Model gpt-3.5-turbo does not support deep research execution');
    });

    it('should handle provider execution errors', async () => {
      mockAiSource.deepResearch.mockRejectedValue(new Error('Provider API error'));

      const jobData = {
        jobId: 'test-job-id',
        userId: 'user-123',
        chatId: 'chat-456',
        messageId: 'msg-789',
        modelId: 'o4-mini-deep-research',
        input: 'Test input',
        instructions: 'Test instructions',
        maxToolCalls: 10,
      };

      await expect(workerCallback({
        data: jobData,
      })).rejects.toThrow('Provider API error');

      expect(logger.error).toHaveBeenCalledWith(
        'Deep research job test-job-id failed:',
        expect.objectContaining({
          message: 'Provider API error',
        })
      );
    });

    it('should handle null messageId gracefully', async () => {
      mockAiSource.deepResearch.mockResolvedValue('Deep research content');

      const jobData = {
        jobId: 'test-job-id',
        userId: 'user-123',
        chatId: 'chat-456',
        messageId: null, // null messageId
        modelId: 'o4-mini-deep-research',
        input: 'Test input',
        instructions: 'Test instructions',
        maxToolCalls: 10,
      };

      const result = await workerCallback({
        data: jobData,
      });

      expect(result).toEqual({ content: 'test content' });
      
      // Should not call database update when messageId is null
      expect(db.chatMessage.update).not.toHaveBeenCalled();
    });

    it('enqueues the completed message when the memory toggle is on', async () => {
      (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
      mockAiSource.deepResearch.mockResolvedValue('Deep research content');

      await workerCallback({
        data: {
          jobId: 'test-job-id',
          userId: 'user-123',
          chatId: 'chat-456',
          messageId: 'msg-789',
          modelId: 'o4-mini-deep-research',
          input: 'Test input',
          instructions: 'Test instructions',
          maxToolCalls: 10,
        },
      });

      expect(db.chatMessage.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-789' },
        select: { chatId: true },
      });
      expect(enqueueConversationGraphSync).toHaveBeenCalledWith({
        chatId: 'chat-456',
        messageIds: ['msg-789'],
      });
    });

    it('does not enqueue the completed message when the memory toggle is off', async () => {
      (isMemoryEnabled as jest.Mock).mockResolvedValue(false);
      mockAiSource.deepResearch.mockResolvedValue('Deep research content');

      await workerCallback({
        data: {
          jobId: 'test-job-id',
          userId: 'user-123',
          chatId: 'chat-456',
          messageId: 'msg-789',
          modelId: 'o4-mini-deep-research',
          input: 'Test input',
          instructions: 'Test instructions',
          maxToolCalls: 10,
        },
      });

      expect(db.chatMessage.findUnique).not.toHaveBeenCalled();
      expect(enqueueConversationGraphSync).not.toHaveBeenCalled();
    });
  });
});
