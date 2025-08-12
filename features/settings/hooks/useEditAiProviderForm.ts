import { useForm, zodResolver } from '@mantine/form';
import useUpdateAiProvider from '@/features/settings/api/update-ai-provider';
import { passwordInputPlaceholder } from '@/features/shared/utils';
import { generateConditionalAiProviderSchema } from '@/features/shared/types';

export type EditAiProviderFormValues = {
  aiProvider: string;
  label: string;
  apiKey: string;
  apiEndpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  inputCostPerMillionTokens?: number;
  outputCostPerMillionTokens?: number;
};

export type SubmitResult = {
  success: boolean;
  error?: any;
};

/**
 * Custom hook to manage AI provider form state and submission logic
 * 
 * This hook focuses on:
 * 1. Form initialization with validation schema
 * 2. Form submission logic with error handling
 * 
 * @param aiProviderId - The ID of the AI provider being edited
 * @param initialValues - Initial values for the form fields
 * @param selectedProviderType - The numeric type of the selected AI provider for schema validation
 * @returns Object containing form instance, submission handler, and loading state
 */
export function useEditAiProviderForm(
  aiProviderId: string,
  initialValues: EditAiProviderFormValues,

  selectedProviderType: number
) {
  const {
    mutateAsync: updateAiProvider,
    isPending: updateAiProviderIsPending,
    error: updateAiProviderError,
  } = useUpdateAiProvider();

  // Initialize form with validation based on the selected provider type
  const form = useForm<EditAiProviderFormValues>({
    initialValues,
    validate: zodResolver(
      generateConditionalAiProviderSchema({
        label: '',
        value: String(selectedProviderType),
      })
    ),
  });

  /**
   * Handles the form submission process
   * 
   * @param values - The current form values to submit
   * @returns Result object indicating success or failure with error details
   */
  const handleSubmit = async (values: EditAiProviderFormValues): Promise<SubmitResult> => {
    try {
      const apiKey = values.apiKey.trim();
      const accessKeyId = values.accessKeyId.trim();
      const secretAccessKey = values.secretAccessKey.trim();
      const sessionToken = values.sessionToken.trim();

      await updateAiProvider({
        id: aiProviderId,
        label: values.label,
        apiKey: apiKey === passwordInputPlaceholder ? '' : apiKey,
        accessKeyId: accessKeyId === passwordInputPlaceholder ? '' : accessKeyId,
        secretAccessKey: secretAccessKey === passwordInputPlaceholder ? '' : secretAccessKey,
        sessionToken: sessionToken === passwordInputPlaceholder ? '' : sessionToken,
        apiEndpoint: values.apiEndpoint,
        region: values.region,
        inputCostPerMillionTokens: values.inputCostPerMillionTokens,
        outputCostPerMillionTokens: values.outputCostPerMillionTokens,
      });

      form.reset();
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  return {
    form,
    handleSubmit,
    updateAiProviderIsLoading: updateAiProviderIsPending,
    updateAiProviderError,
  };
}
