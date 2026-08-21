import { act, renderHook } from '@testing-library/react';

import { useGenerateInstructionsForm } from './useGenerateInstructionsForm';
import { useGeneratePrompt } from '../api/generate-prompt';

jest.mock('@/features/prompt-generator/api/generate-prompt');

/**
 * Helper to set up the mocked API hook.
 * @param response - The text response for a successful call.
 * @param isLoading - The loading state.
 * @param error - The error (if any) for a failed call.
 */
const setupMockGeneratePrompt = (
  response: string = '',
  isPending: boolean = false,
  error: unknown = null
) => {
  const mutateAsync = jest.fn();

  if (!error) {
    mutateAsync.mockResolvedValue({ text: response });
  } else {
    mutateAsync.mockRejectedValue(error);
  }

  (useGeneratePrompt as jest.Mock).mockReturnValue({
    mutateAsync,
    isPending,
    error,
  });
};

describe('useGenerateInstructionsForm', () => {
  const setup = () => renderHook(() => useGenerateInstructionsForm(''));

  beforeEach(setupMockGeneratePrompt);
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
  });

  describe('generateInstructions', () => {
    it('calls generatePrompt when generateInstructions is called', async () => {
      setupMockGeneratePrompt('test response');
      const { result } = setup();

      const { generateInstructions } = result.current;

      const values = { prompt: 'test prompt' };

      await expect(generateInstructions(values)).resolves.toEqual('test response');
    });

    it('sets isPending to true when api is pending', () => {
      setupMockGeneratePrompt('', true);
      const { result } = setup();

      const { isPending } = result.current;

      expect(isPending).toBe(true);
    });

    it('sets hasError to true when api call fails', async () => {
      setupMockGeneratePrompt(undefined, false, new Error('API error'));
      const { result } = setup();

      await act(async () => {
        await expect(result.current.generateInstructions({ prompt: 'test prompt' }))
          .rejects
          .toThrow('There was a problem generating instructions');
      });

      expect(result.current.hasError).toBe(true);
    });

    it('returns the original error if api call fails', async () => {
      const mockError = new Error('API error');
      setupMockGeneratePrompt(undefined, false, mockError);
      const { result } = setup();

      await act(async () => {
        await expect(result.current.generateInstructions({ prompt: 'test prompt' }))
          .rejects
          .toThrow('There was a problem generating instructions');
      });

      expect(result.current.error).toBe(mockError);
    });
  });
});
