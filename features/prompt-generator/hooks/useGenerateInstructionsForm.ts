import { useContext, useEffect, useState } from 'react';
import { useForm, zodResolver } from '@mantine/form';

import { GeneratePromptInstructions, generatePromptInstructionsSchema } from '@/features/prompt-generator/types';
import { useGeneratePrompt } from '@/features/prompt-generator/api/generate-prompt';
import { SafeExitContext } from '@/features/shared/utils';

export function useGenerateInstructionsForm(initialPrompt: string) {
  const form = useForm<GeneratePromptInstructions>({
    initialValues: {
      prompt: initialPrompt,
    },
    validate: zodResolver(generatePromptInstructionsSchema),
  });

  const { setSafeExitFormToDirty } = useContext(SafeExitContext);
  const { mutateAsync, isPending, error } = useGeneratePrompt();
  const [hasError, setHasError] = useState<boolean>(false);

  const { isDirty } = form;
  useEffect(() => {
    if (isDirty()) {
      setSafeExitFormToDirty(true);
    }

    return () => {
      setSafeExitFormToDirty(false);
    };
  }, [isDirty, setSafeExitFormToDirty]);

  async function generateInstructions(values: GeneratePromptInstructions): Promise<string> {
    setHasError(false);

    try {
      const response = await mutateAsync({ prompt: values.prompt });
      return response.text;
    } catch (e) {
      setHasError(true);
      throw new Error('There was a problem generating instructions', { cause: e });
    }
  }

  return {
    form,
    generateInstructions,
    isPending,
    hasError,
    error,
  };
}
