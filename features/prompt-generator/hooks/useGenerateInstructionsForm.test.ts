import { act, renderHook } from '@testing-library/react';

import { useGenerateInstructionsForm } from './useGenerateInstructionsForm';
import { useGeneratePrompt } from '../api/generate-prompt';
import { useGetGeneratePromptStatus } from '../api/get-generate-prompt-status';

jest.mock('@/features/prompt-generator/api/generate-prompt');
jest.mock('@/features/prompt-generator/api/get-generate-prompt-status');

/**
 * Helper to set up the mocked mutation hook that queues the job.
 * @param jobId - The jobId returned for a successful call.
 * @param isPending - The loading state.
 * @param error - The error (if any) for a failed call.
 */
const setupMockGeneratePrompt = (
  jobId: string = 'job-1',
  isPending: boolean = false,
  error: unknown = null
) => {
  const mutateAsync = jest.fn();

  if (!error) {
    mutateAsync.mockResolvedValue({ jobId });
  } else {
    mutateAsync.mockRejectedValue(error);
  }

  (useGeneratePrompt as jest.Mock).mockReturnValue({
    mutateAsync,
    isPending,
    error,
  });
};

/**
 * Helper to set up the mocked status query hook that polling reads from.
 * @param status - The job status to report, or undefined for no data yet.
 * @param text - The generated text to report when status is 'done'.
 */
const setupMockGetGeneratePromptStatus = (
  status?: 'done' | 'error',
  text: string = ''
) => {
  (useGetGeneratePromptStatus as jest.Mock).mockReturnValue({
    data: status
      ? {
        status,
        response: status === 'done' ? { text } : undefined,
        error: status === 'error' ? 'boom' : undefined,
      }
      : undefined,
  });
};

describe('useGenerateInstructionsForm', () => {
  const setup = () => renderHook(() => useGenerateInstructionsForm(''));

  beforeEach(() => {
    setupMockGeneratePrompt();
    setupMockGetGeneratePromptStatus();
  });
  afterEach(jest.clearAllMocks);

  describe('Initialization', () => {
    it('should initialize form with empty prompt', () => {
      const { result } = setup();

      const { form } = result.current;

      expect(form.values.prompt).toBe('');
    });

    it('should initialize error to false', () => {
      const { result } = setup();

      const { hasError } = result.current;

      expect(hasError).toBe(false);
    });

    it('should initialize isPending to false', () => {
      const { result } = setup();

      const { isPending } = result.current;

      expect(isPending).toBe(false);
    });

    it('should initialize error to null', () => {
      const { result } = setup();

      const { error } = result.current;

      expect(error).toBe(null);
    });

    it('should initialize generatedText to null', () => {
      const { result } = setup();

      const { generatedText } = result.current;

      expect(generatedText).toBe(null);
    });
  });

  describe('generateInstructions', () => {
    it('surfaces the generated text once the queued job completes', async () => {
      setupMockGeneratePrompt('job-1');
      setupMockGetGeneratePromptStatus('done', 'test response');
      const { result, rerender } = setup();

      await act(async () => {
        await result.current.generateInstructions({ prompt: 'test prompt' });
      });
      rerender();

      expect(result.current.generatedText).toBe('test response');
    });

    it('sets isPending to true when the queue mutation is pending', () => {
      setupMockGeneratePrompt('job-1', true);
      const { result } = setup();

      const { isPending } = result.current;

      expect(isPending).toBe(true);
    });

    it('sets hasError to true when the queue mutation fails', async () => {
      setupMockGeneratePrompt('job-1', false, new Error('API error'));
      const { result } = setup();

      await act(async () => {
        await expect(result.current.generateInstructions({ prompt: 'test prompt' }))
          .rejects
          .toThrow('There was a problem generating instructions');
      });

      expect(result.current.hasError).toBe(true);
    });

    it('returns the original error if the queue mutation fails', async () => {
      const mockError = new Error('API error');
      setupMockGeneratePrompt('job-1', false, mockError);
      const { result } = setup();

      await act(async () => {
        await expect(result.current.generateInstructions({ prompt: 'test prompt' }))
          .rejects
          .toThrow('There was a problem generating instructions');
      });

      expect(result.current.error).toBe(mockError);
    });

    it('sets hasError to true when the queued job itself fails', async () => {
      setupMockGeneratePrompt('job-1');
      setupMockGetGeneratePromptStatus('error');
      const { result, rerender } = setup();

      await act(async () => {
        await result.current.generateInstructions({ prompt: 'test prompt' });
      });
      rerender();

      expect(result.current.hasError).toBe(true);
    });
  });
});
