import { useState } from 'react';
import { UseFormReturnType } from '@mantine/form';
import { AiProviderType } from '@/features/shared/types';
import { EditAiProviderFormValues } from './useEditAiProviderForm';

type ReplaceAwsFields = {
  accessKeyId: boolean;
  secretAccessKey: boolean;
  sessionToken: boolean;
}

/**
 * Custom hook to manage AI provider configuration fields visibility and replacement
 * 
 * This hook is responsible for:
 * 1. Determining which config fields should be visible based on provider type
 * 2. Managing the state of secret field replacements
 * 3. Providing functions to handle the "Replace" action for credential fields
 * 
 * @param form - Form object from useEditAiProviderForm
 * @param selectedAiProvider - The numerical provider type 
 * @returns Configuration state and handlers for provider-specific fields
 */
export function useEditAiProviderConfig(
  form: UseFormReturnType<EditAiProviderFormValues>,
  selectedAiProvider: number
) {
  // Track which fields are being replaced
  const [replaceApiKey, setReplaceApiKey] = useState(false);
  const [replaceAwsFields, setReplaceAwsFields] = useState<ReplaceAwsFields>({
    accessKeyId: false,
    secretAccessKey: false,
    sessionToken: false,
  });

  // Computed properties for field visibility
  const displayInputApiEndpoint =
    selectedAiProvider === AiProviderType.AzureOpenAi;

  const displayInputApiKey =
    selectedAiProvider === AiProviderType.OpenAi ||
    selectedAiProvider === AiProviderType.AzureOpenAi ||
    selectedAiProvider === AiProviderType.Anthropic ||
    selectedAiProvider === AiProviderType.Gemini;

  const displayAwsFields = selectedAiProvider === AiProviderType.Bedrock;

  /**
   * Handle replacing a secret field placeholder with an input field
   * Updates both the UI state and clears the field value
   * 
   * @param field - Optional field name to identify which AWS credential to replace
   *                If not provided, defaults to replacing the API key
   */
  const handleReplace = (field?: string) => {
    switch (field) {
      case 'accessKeyId':
        setReplaceAwsFields({ ...replaceAwsFields, accessKeyId: true });
        form.setFieldValue('accessKeyId', '');
        break;
      case 'secretAccessKey':
        setReplaceAwsFields({ ...replaceAwsFields, secretAccessKey: true });
        form.setFieldValue('secretAccessKey', '');
        break;
      case 'sessionToken':
        setReplaceAwsFields({ ...replaceAwsFields, sessionToken: true });
        form.setFieldValue('sessionToken', '');
        break;
      default:
        setReplaceApiKey(true);
        form.setFieldValue('apiKey', '');
        break;
    }
  };

  return {
    // Field visibility flags
    displayInputApiEndpoint,
    displayInputApiKey,
    displayAwsFields,

    // Replacement state
    replaceApiKey,
    replaceAwsFields,

    // Handlers
    handleReplace,
  };
}

