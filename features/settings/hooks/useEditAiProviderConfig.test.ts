import { renderHook, act } from '@testing-library/react';
import { useEditAiProviderConfig } from './useEditAiProviderConfig';
import { AiProviderType } from '@/features/shared/types';
import { passwordInputPlaceholder } from '@/features/shared/utils';

describe('useEditAiProviderConfig hook', () => {
  const createFormMock = () => {
    return {
      values: {
        apiKey: passwordInputPlaceholder,
        accessKeyId: passwordInputPlaceholder,
        secretAccessKey: passwordInputPlaceholder,
        sessionToken: passwordInputPlaceholder,
      },
      setFieldValue: jest.fn(),
    };
  };

  it('initializes with correct field visibility based on provider type', () => {
    // OpenAI
    const formMock = createFormMock();
    const { result: openAiResult } = renderHook(() => 
      useEditAiProviderConfig(formMock as any, AiProviderType.OpenAi)
    );
    
    expect(openAiResult.current.displayInputApiKey).toBe(true);
    expect(openAiResult.current.displayInputApiEndpoint).toBe(false);
    expect(openAiResult.current.displayAwsFields).toBe(false);
    
    // Azure OpenAI 
    const { result: azureResult } = renderHook(() => 
      useEditAiProviderConfig(formMock as any, AiProviderType.AzureOpenAi)
    );
    
    expect(azureResult.current.displayInputApiKey).toBe(true);
    expect(azureResult.current.displayInputApiEndpoint).toBe(true);
    expect(azureResult.current.displayAwsFields).toBe(false);
    
    // Bedrock 
    const { result: bedrockResult } = renderHook(() => 
      useEditAiProviderConfig(formMock as any, AiProviderType.Bedrock)
    );
    
    expect(bedrockResult.current.displayInputApiKey).toBe(false);
    expect(bedrockResult.current.displayInputApiEndpoint).toBe(false);
    expect(bedrockResult.current.displayAwsFields).toBe(true);
  });

  it('handles replace for API key correctly', () => {
    const formMock = createFormMock();
    const { result } = renderHook(() => useEditAiProviderConfig(formMock as any, AiProviderType.OpenAi));

    act(() => {
      result.current.handleReplace();
    });

    expect(result.current.replaceApiKey).toBe(true);

    expect(formMock.setFieldValue).toHaveBeenCalledWith('apiKey', '');
  });

  it('handles replace for AWS fields correctly', () => {
    const formMock = createFormMock();
    const { result } = renderHook(() => useEditAiProviderConfig(formMock as any, AiProviderType.Bedrock));
    
    expect(result.current.replaceAwsFields.accessKeyId).toBe(false);
    expect(result.current.replaceAwsFields.secretAccessKey).toBe(false);
    expect(result.current.replaceAwsFields.sessionToken).toBe(false);
    
    act(() => {
      result.current.handleReplace('accessKeyId');
    });
    
    expect(result.current.replaceAwsFields.accessKeyId).toBe(true);
    expect(result.current.replaceAwsFields.secretAccessKey).toBe(false);
    expect(result.current.replaceAwsFields.sessionToken).toBe(false);
    expect(formMock.setFieldValue).toHaveBeenCalledWith('accessKeyId', '');
    
    act(() => {
      result.current.handleReplace('secretAccessKey');
    });
    
    expect(result.current.replaceAwsFields.secretAccessKey).toBe(true);
    expect(formMock.setFieldValue).toHaveBeenCalledWith('secretAccessKey', '');
    
    act(() => {
      result.current.handleReplace('sessionToken');
    });
    
    expect(result.current.replaceAwsFields.sessionToken).toBe(true);
    expect(formMock.setFieldValue).toHaveBeenCalledWith('sessionToken', '');
  });
});
