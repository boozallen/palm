import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';

import { Prompt } from '@/features/shared/types';
import useRunPromptForm from '@/features/library/hooks/useRunPromptForm';

type RunPromptFormReturnType = ReturnType<typeof useRunPromptForm>;

interface PromptDetailsContextData {
  prompt: Prompt;
  form: RunPromptFormReturnType['form'];
  response: RunPromptFormReturnType['response'];
  isPending: RunPromptFormReturnType['isPending'];
  hasError: RunPromptFormReturnType['hasError'];
  handleSubmit: RunPromptFormReturnType['handleSubmit'];
  targetRef: RunPromptFormReturnType['targetRef'];
  error: RunPromptFormReturnType['error'];
}

const PromptDetailsContext = createContext<PromptDetailsContextData | undefined>(undefined);

type PromptDetailsProviderProps = Readonly<{
  children: React.ReactNode;
  prompt: Prompt;
}>;

export function PromptDetailsProvider({
  children,
  prompt,
}: PromptDetailsProviderProps) {
  const {
    form,
    response,
    isPending,
    hasError,
    handleSubmit,
    targetRef,
    error,
  } = useRunPromptForm({
    initialValues: {
      instructions: prompt.instructions,
      example: prompt.example,
      config: {
        ...prompt.config,
        model: prompt.config.model || '',
      },
    },
  });

  const initializedRef = useRef(false);
  const router = useRouter();

  /* Hook used to update form data when user cancels CreatePromptForm */
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    const data = router.query.returnedPromptData;
    if (typeof data !== 'string') {
      return;
    }

    try {
      const parsedData = JSON.parse(data);
      form.setValues({
        example: parsedData.example || prompt.example,
        instructions: parsedData.instructions || prompt.instructions,
        config: parsedData.config || prompt.config,
      });
    } catch (error) {
      // Ignore errors and keep the form's current state
    } finally {
      // Remove the query parameter regardless of success or failure
      const { returnedPromptData: _, ...restQuery } = router.query;
      router.replace({ query: restQuery }, undefined, { shallow: true });
    }

    initializedRef.current = true;
  }, [router, form, prompt.config, prompt.example, prompt.instructions]);

  const values = useMemo(() => ({
    prompt,
    form,
    response,
    isPending,
    hasError,
    handleSubmit,
    targetRef,
    error,
  }), [
    prompt,
    form,
    response,
    isPending,
    hasError,
    handleSubmit,
    targetRef,
    error,
  ]);

  return (
    <PromptDetailsContext.Provider value={values}>
      {children}
    </PromptDetailsContext.Provider>
  );
}

export function usePromptDetails() {
  const context = useContext(PromptDetailsContext);

  if (!context) {
    throw new Error('An unexpected error occurred. Please try again later.');
  }

  return context;
}
