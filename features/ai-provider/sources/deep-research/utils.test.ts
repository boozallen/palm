import {
  logDeepResearchJobStarted,
  logDeepResearchError,
  logDeepResearchCompleted,
  logDeepResearchPolling,
} from './utils';
import logger from '@/server/logger';

jest.mock('@/server/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
}));

describe('deepResearchUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logDeepResearchJobStarted', () => {
    it('should log job started', () => {
      logDeepResearchJobStarted('OpenAI', 'job-123');

      expect(logger.debug).toHaveBeenCalledWith('OpenAI deep research job started: job-123');
    });
  });

  describe('logDeepResearchError', () => {
    it('should log error with Error object', () => {
      const error = new Error('Test error message');
      error.stack = 'Error stack trace';

      logDeepResearchError('OpenAI', error);

      expect(logger.error).toHaveBeenCalledWith('OpenAI deep research failed:', {
        error: 'Test error message',
        stack: 'Error stack trace',
      });
    });

    it('should log error with string', () => {
      const error = 'String error';

      logDeepResearchError('Anthropic', error);

      expect(logger.error).toHaveBeenCalledWith('Anthropic deep research failed:', {
        error: 'String error',
        stack: '',
      });
    });
  });

  describe('logDeepResearchCompleted', () => {
    it('should log completion', () => {
      logDeepResearchCompleted('OpenAI', 'job-123');

      expect(logger.debug).toHaveBeenCalledWith('OpenAI deep research job job-123 completed');
    });
  });

  describe('logDeepResearchPolling', () => {
    it('should log polling error with Error object', () => {
      const error = new Error('Polling failed');

      logDeepResearchPolling('OpenAI', 'job-123', error);

      expect(logger.error).toHaveBeenCalledWith('Failed to poll OpenAI deep research status:', {
        jobId: 'job-123',
        error: 'Polling failed',
      });
    });

    it('should log polling error with string', () => {
      const error = 'Network timeout';

      logDeepResearchPolling('Gemini', 'job-456', error);

      expect(logger.error).toHaveBeenCalledWith('Failed to poll Gemini deep research status:', {
        jobId: 'job-456',
        error: 'Network timeout',
      });
    });
  });
});
