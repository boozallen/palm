import { useEffect, useState, useContext } from 'react';
import { useForm, UseFormReturnType, zodResolver } from '@mantine/form';
import { useScrollIntoView } from '@mantine/hooks';

import { useRunPrompt } from '@/features/shared/api/run-prompt';
import { RunPromptForm, runPromptFormSchema } from '@/features/shared/types';
import { SafeExitContext } from '@/features/shared/utils';
import { AiResponse } from '@/features/ai-provider/sources/types';

type useRunPromptFormProps = Readonly<{
  initialValues: RunPromptForm;
}>;

/**
 * A custom hook to manage prompt submission and form state.
 *
 * This hook:
 * 1. Sets up a Mantine form using Zod-based validation for prompt fields (`instructions`, `example`, `config`).
 * 2. Tracks whether the form is dirty to enable a “safe exit” feature.
 * 3. Provides a method to submit the form to an API, scrolling the page upon successful submission.
 * 4. Returns the form instance, loading/error status, the API response, and a scroll reference.
 *
 * @param initialValues - The initial form values (instructions, example, config).
 * @returns An object containing:
 *   - `form`: The Mantine form instance for tracking values, validation, and form state.
 *   - `response`: The API response from running the prompt, if available.
 *   - `isPending`: Whether a prompt submission is currently in progress.
 *   - `isError`: Whether an error occurred during submission.
 *   - `handleSubmit`: A function to submit the current form values to the API.
 *   - `targetRef`: A ref for scrolling the view on successful submission.
 *   - `error`: The error object (if any) from the prompt submission.
 */
export default function useRunPromptForm({
  initialValues,
}: useRunPromptFormProps): {
  form: UseFormReturnType<RunPromptForm>;
  response: AiResponse | undefined;
  isPending: boolean;
  hasError: boolean;
  handleSubmit: (values: RunPromptForm) => Promise<void>;
  targetRef: React.RefObject<HTMLDivElement>;
  error: any;
} {
  const {
    mutateAsync,
    isPending,
    data: response,
    error,
  } = useRunPrompt();

  const { setSafeExitFormToDirty } = useContext(SafeExitContext);
  const { scrollIntoView, targetRef } = useScrollIntoView<HTMLDivElement>();
  const [hasError, setHasError] = useState(false);

  const form = useForm<RunPromptForm>({
    initialValues,
    validate: zodResolver(runPromptFormSchema),
  });

  const { isDirty } = form;

  useEffect(() => {
    if (isDirty()) {
      setSafeExitFormToDirty(true);
    }

    return () => {
      setSafeExitFormToDirty(false);
    };
  }, [isDirty, setSafeExitFormToDirty]);

  async function handleSubmit(values: RunPromptForm) {
    setHasError(false);
    try {
      await mutateAsync({
        instructions: `${values.instructions}\n\n${values.example}`,
        config: values.config,
      });

      scrollIntoView({ alignment: 'start' });
    } catch (error) {
      setHasError(true);
    }
  }

  return {
    form,
    response,
    isPending,
    hasError,
    handleSubmit,
    targetRef,
    error,
  };
}
