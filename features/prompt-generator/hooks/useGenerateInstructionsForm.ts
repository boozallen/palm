import { useContext, useEffect, useState } from 'react';
import { useForm, zodResolver } from '@mantine/form';

import { GeneratePromptInstructions, generatePromptInstructionsSchema } from '@/features/prompt-generator/types';
import { useGeneratePrompt } from '@/features/prompt-generator/api/generate-prompt';
import { useGetGeneratePromptStatus } from '@/features/prompt-generator/api/get-generate-prompt-status';
import { SafeExitContext } from '@/features/shared/utils';

export function useGenerateInstructionsForm(initialPrompt: string) {
  const form = useForm<GeneratePromptInstructions>({
    initialValues: {
      prompt: initialPrompt,
    },
    validate: zodResolver(generatePromptInstructionsSchema),
  });

  const { setSafeExitFormToDirty } = useContext(SafeExitContext);
  const { mutateAsync, isPending: isSubmitting, error } = useGeneratePrompt();
  const [hasError, setHasError] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const { data: jobStatus } = useGetGeneratePromptStatus(jobId);

  const isPending = isSubmitting || (!!jobId && jobStatus?.status !== 'done' && jobStatus?.status !== 'error');

  const { isDirty } = form;
  useEffect(() => {
    if (isDirty()) {
      setSafeExitFormToDirty(true);
    }

    return () => {
      setSafeExitFormToDirty(false);
    };
  }, [isDirty, setSafeExitFormToDirty]);

  useEffect(() => {
    if (!jobStatus || !jobId) {
      return;
    }

    if (jobStatus.status === 'done' && jobStatus.response) {
      setGeneratedText(jobStatus.response.text);
      setJobId(null);
    } else if (jobStatus.status === 'error') {
      setHasError(true);
      setJobId(null);
    }
  }, [jobStatus, jobId]);

  async function generateInstructions(values: GeneratePromptInstructions): Promise<void> {
    setHasError(false);
    setGeneratedText(null);

    try {
      const { jobId: newJobId } = await mutateAsync({ prompt: values.prompt });
      setJobId(newJobId);
    } catch (e) {
      setHasError(true);
      throw new Error('There was a problem generating instructions', { cause: e });
    }
  }

  return {
    form,
    generateInstructions,
    generatedText,
    isPending,
    hasError,
    error,
  };
}
