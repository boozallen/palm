import React from 'react';
import { useScrollIntoView } from '@mantine/hooks';
import { act, renderHook } from '@testing-library/react';

import { AiResponse } from '@/features/ai-provider/sources/types';
import { RunPromptForm } from '@/features/shared/types';
import { useRunPrompt } from '@/features/shared/api/run-prompt';
import useRunPromptForm from './useRunPromptForm';

jest.mock('@mantine/hooks');
jest.mock('@/features/shared/api/run-prompt');

describe('useRunPromptForm', () => {
  const mockInitialValues: RunPromptForm = {
    instructions: 'Test instructions',
    example: 'Test example',
    config: {
      model: '',
      randomness: 0.5,
      repetitiveness: 0.5,
    },
  };

  const mockResponse: AiResponse = {
    text: 'Test response',
    inputTokensUsed: 100,
    outputTokensUsed: 100,
  };

  const runPrompt = jest.fn();
  const scrollIntoView = jest.fn();
  const setSafeExitFormToDirty = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    (useRunPrompt as jest.Mock).mockReturnValue({
      mutateAsync: runPrompt,
      isPending: false,
      data: mockResponse,
      error: undefined,
    });

    (useScrollIntoView as jest.Mock).mockReturnValue({
      scrollIntoView,
      targetRef: null,
    });

    jest.spyOn(React, 'useContext').mockReturnValue({
      setSafeExitFormToDirty,
    });
  });

  describe('Sanity checks', () => {
    it('initializes form with initial values', () => {
      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      expect(result.current.form.values).toEqual(mockInitialValues);
    });

    it('returns response when available', () => {
      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      expect(result.current.response).toEqual(mockResponse);
    });

    it('returns isPending', () => {
      const { result, rerender } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      expect(result.current.isPending).toBe(false);

      (useRunPrompt as jest.Mock).mockReturnValue({
        mutateAsync: runPrompt,
        isPending: true,
        data: undefined,
        error: undefined,
      });

      rerender();

      expect(result.current.isPending).toBe(true);
    });
  });

  describe('From submission', () => {
    it('calls mutateAsync with correct payload on submit', async () => {
      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      await act(async () => {
        await result.current.handleSubmit(result.current.form.values);
      });

      expect(runPrompt).toHaveBeenCalledWith({
        instructions: `${mockInitialValues.instructions}\n\n${mockInitialValues.example}`,
        config: mockInitialValues.config,
      });
    });

    it('calls scrollIntoView upon successful submission', async () => {
      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      await act(async () => {
        await result.current.handleSubmit(result.current.form.values);
      });

      expect(scrollIntoView).toHaveBeenCalledWith({
        alignment: 'start',
      });
    });
  });

  describe('Error handling', () => {
    it('does not call scrollIntoView if api call throws', async () => {
      runPrompt.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      await act(async () => {
        await result.current.handleSubmit(result.current.form.values);
      });

      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('sets hasError to true if api call throws', async () => {
      runPrompt.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      await act(async () => {
        await result.current.handleSubmit(result.current.form.values);
      });

      expect(result.current.hasError).toBe(true);
    });

    it('returns error object if api call throws', async () => {
      const testError = new Error('Test error');
      (useRunPrompt as jest.Mock).mockReturnValue({
        mutateAsync: jest.fn().mockRejectedValue(testError),
        isPending: false,
        data: undefined,
        error: testError,
      });

      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      await act(async () => {
        await result.current.handleSubmit(result.current.form.values);
      });

      expect(result.current.error).toBe(testError);
    });
  });

  describe('Safe exit context', () => {
    it('sets safeExitFormToDirty when form is dirty', () => {
      const { result } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      expect(setSafeExitFormToDirty).not.toHaveBeenCalled();

      act(() => {
        result.current.form.setFieldValue('instructions', 'New instructions');
      });

      expect(result.current.form.isDirty()).toBe(true);
      expect(setSafeExitFormToDirty).toHaveBeenCalledWith(true);
    });

    it('resets safeExitFormToDirty when hook unmounts', () => {
      const { result, unmount } = renderHook(() => useRunPromptForm({ initialValues: mockInitialValues }));

      act(() => {
        result.current.form.setFieldValue('instructions', 'New instructions');
      });

      unmount();

      expect(setSafeExitFormToDirty).toHaveBeenCalledWith(false);
    });
  });
});
