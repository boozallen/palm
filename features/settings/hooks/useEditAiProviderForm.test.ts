import { renderHook, act } from '@testing-library/react';
import { useEditAiProviderForm } from './useEditAiProviderForm';
import useUpdateAiProvider from '@/features/settings/api/ai-providers/update-ai-provider';
import { passwordInputPlaceholder } from '@/features/shared/utils';
import { AiProviderType } from '@/features/shared/types';

jest.mock('@/features/settings/api/ai-providers/update-ai-provider');

describe('useEditAiProviderForm hook', () => {
  const aiProviderId = 'd991cc5c-4710-474e-ad8d-57e8627c4fa7';
  const updateAiProviderMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateAiProvider as jest.Mock).mockReturnValue({
      mutateAsync: updateAiProviderMock,
      isPending: false,
      error: null,
    });
  });

  const defaultInitialValues = {
    aiProvider: AiProviderType.OpenAi.toString(),
    label: 'Test Provider',
    apiKey: passwordInputPlaceholder,
    apiEndpoint: '',
    accessKeyId: passwordInputPlaceholder,
    secretAccessKey: passwordInputPlaceholder,
    sessionToken: passwordInputPlaceholder,
    region: '',
    inputCostPerMillionTokens: 10,
    outputCostPerMillionTokens: 20,
  };

  it('initializes form with correct values', () => {
    const selectedProviderType = AiProviderType.OpenAi;
    const { result } = renderHook(() =>
      useEditAiProviderForm(aiProviderId, defaultInitialValues, selectedProviderType)
    );

    expect(result.current.form.values).toEqual(defaultInitialValues);
  });

  it('exposes loading state from the API hook', () => {
    (useUpdateAiProvider as jest.Mock).mockReturnValue({
      mutateAsync: updateAiProviderMock,
      isPending: true,
      error: null,
    });

    const selectedProviderType = AiProviderType.OpenAi;
    const { result } = renderHook(() =>
      useEditAiProviderForm(aiProviderId, defaultInitialValues, selectedProviderType)
    );

    expect(result.current.updateAiProviderIsLoading).toBe(true);
  });

  describe('form validation', () => {
    it('validates required label field', async () => {
      const initialValues = {
        ...defaultInitialValues,
        label: '',
      };

      const selectedProviderType = AiProviderType.OpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, initialValues, selectedProviderType)
      );

      act(() => {
        result.current.form.validate();
      });

      expect(result.current.form.errors.label).toBeTruthy();
      expect(result.current.form.errors.label).toContain('A label is required');
    });

    it('validates token cost cannot be negative', async () => {
      const initialValues = {
        ...defaultInitialValues,
        inputCostPerMillionTokens: -10,
        outputCostPerMillionTokens: -20,
      };

      const selectedProviderType = AiProviderType.OpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, initialValues, selectedProviderType)
      );

      act(() => {
        result.current.form.validate();
      });

      expect(result.current.form.errors.inputCostPerMillionTokens).toBeTruthy();
      expect(result.current.form.errors.inputCostPerMillionTokens).toContain('Input token cost cannot be less than $0.00');
      expect(result.current.form.errors.outputCostPerMillionTokens).toBeTruthy();
      expect(result.current.form.errors.outputCostPerMillionTokens).toContain('Output token cost cannot be less than $0.00');
    });

    it('validates OpenAI provider requires API key', async () => {
      const initialValues = {
        ...defaultInitialValues,
        apiKey: '',
      };

      const selectedProviderType = AiProviderType.OpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, initialValues, selectedProviderType)
      );

      act(() => {
        result.current.form.validate();
      });

      expect(result.current.form.errors.apiKey).toBeTruthy();
      expect(result.current.form.errors.apiKey).toContain('An API key is required');
    });

    it('validates Azure OpenAI provider requires API endpoint', async () => {
      const initialValues = {
        ...defaultInitialValues,
        apiEndpoint: '',
        aiProvider: AiProviderType.AzureOpenAi.toString(),
      };

      const selectedProviderType = AiProviderType.AzureOpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, initialValues, selectedProviderType)
      );

      act(() => {
        result.current.form.validate();
      });

      expect(result.current.form.errors.apiEndpoint).toBeTruthy();
      expect(result.current.form.errors.apiEndpoint).toContain('An API endpoint is required');
    });
  });

  describe('form submission', () => {
    it('submits form with correct values and returns success', async () => {
      const testValues = {
        ...defaultInitialValues,
        label: 'Updated Label',
        apiKey: 'new-api-key',
      };

      updateAiProviderMock.mockResolvedValueOnce({});

      const selectedProviderType = AiProviderType.OpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, defaultInitialValues, selectedProviderType)
      );

      let submitResult;
      await act(async () => {
        submitResult = await result.current.handleSubmit(testValues);
      });

      expect(updateAiProviderMock).toHaveBeenCalledWith({
        id: aiProviderId,
        label: testValues.label,
        apiKey: testValues.apiKey,
        apiEndpoint: testValues.apiEndpoint,
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: testValues.region,
        inputCostPerMillionTokens: testValues.inputCostPerMillionTokens,
        outputCostPerMillionTokens: testValues.outputCostPerMillionTokens,
      });

      expect(submitResult).toEqual({ success: true });
    });

    it('handles form submission errors', async () => {
      const testValues = { ...defaultInitialValues };
      const testError = new Error('API submission failed');

      updateAiProviderMock.mockRejectedValueOnce(testError);

      const selectedProviderType = AiProviderType.OpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, defaultInitialValues, selectedProviderType)
      );

      let submitResult;

      await act(async () => {
        submitResult = await result.current.handleSubmit(testValues);
      });

      expect(updateAiProviderMock).toHaveBeenCalled();

      expect(submitResult).toEqual({
        success: false,
        error: testError,
      });
    });

    it('resets form on successful submission', async () => {
      updateAiProviderMock.mockResolvedValueOnce({});

      const selectedProviderType = AiProviderType.OpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, defaultInitialValues, selectedProviderType)
      );

      const resetSpy = jest.spyOn(result.current.form, 'reset');

      await act(async () => {
        await result.current.handleSubmit(defaultInitialValues);
      });

      expect(resetSpy).toHaveBeenCalled();
    });

    it('correctly processes placeholder values for submission', async () => {
      const testValues = {
        ...defaultInitialValues,
        apiKey: passwordInputPlaceholder,
        accessKeyId: passwordInputPlaceholder,
        secretAccessKey: passwordInputPlaceholder,
        sessionToken: passwordInputPlaceholder,
      };

      updateAiProviderMock.mockResolvedValueOnce({});

      const selectedProviderType = AiProviderType.OpenAi;
      const { result } = renderHook(() =>
        useEditAiProviderForm(aiProviderId, defaultInitialValues, selectedProviderType)
      );

      await act(async () => {
        await result.current.handleSubmit(testValues);
      });

      expect(updateAiProviderMock).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: '',
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
      }));
    });
  });
});
