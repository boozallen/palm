import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturnType, zodResolver } from '@mantine/form';

import { PromptFormValues, PromptSchema } from '@/features/shared/types';
import { usePromptGeneratorStepper, UsePromptGeneratorStepperReturnType } from '@/features/prompt-generator/hooks';
import { SafeExitContext } from '@/features/shared/utils';

interface PromptGeneratorContextData {
  newPrompt: UseFormReturnType<PromptFormValues>;
  stepper: UsePromptGeneratorStepperReturnType;
  generateInstructionsPrompt: string;
  setGenerateInstructionsPrompt: React.Dispatch<React.SetStateAction<string>>;
}

const PromptGeneratorContext = createContext<PromptGeneratorContextData | undefined>(undefined);

type PromptGeneratorProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export function PromptGeneratorProvider({
  children,
}: PromptGeneratorProviderProps) {
  // Track the initial prompt used to create current instructions
  const [generateInstructionsPrompt, setGenerateInstructionsPrompt] = useState<string>('');

  const stepper = usePromptGeneratorStepper();
  const newPrompt = useForm<PromptFormValues>({
    initialValues: {
      title: '',
      summary: '',
      description: '',
      instructions: '',
      creatorId: null,
      example: '',
      config: {
        randomness: 0.5,
        repetitiveness: 0.5,
        model: '',
      },
      tags: [],
    },
    validate: zodResolver(PromptSchema),
  });

  const { setSafeExitFormToDirty } = useContext(SafeExitContext);

  const { isDirty } = newPrompt;

  useEffect(() => {
    if (isDirty()) {
      setSafeExitFormToDirty(true);
    }

    return () => {
      setSafeExitFormToDirty(false);
    };
  }, [isDirty, setSafeExitFormToDirty]);

  const values = useMemo(() => ({
    newPrompt,
    stepper,
    generateInstructionsPrompt,
    setGenerateInstructionsPrompt,
  }), [
    newPrompt,
    stepper,
    generateInstructionsPrompt,
    setGenerateInstructionsPrompt,
  ]);

  return (
    <PromptGeneratorContext.Provider value={values}>
      {children}
    </PromptGeneratorContext.Provider>
  );
}

export function usePromptGenerator() {
  const context = useContext(PromptGeneratorContext);

  if (!context) {
    throw new Error('An unexpected error occurred. Please try again later.');
  }

  return context;
}
