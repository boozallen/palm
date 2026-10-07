import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Text,
  Textarea,
  Code,
} from '@mantine/core';

import PromptSubmissionErrorNotification from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import { usePromptGenerator } from '@/features/prompt-generator/providers';
import { useGenerateInstructionsForm } from '@/features/prompt-generator/hooks';
import { GeneratePromptInstructions } from '@/features/prompt-generator/types';
import { usePiiDetection } from '@/features/shared/hooks/piiDetection/usePiiDetection';
import PiiDetectionModal from '@/features/shared/components/modals/piiDetectionModal';

export default function GeneratePromptInstructionsForm() {

  const { stepper, generateInstructionsPrompt, setGenerateInstructionsPrompt, newPrompt } = usePromptGenerator();
  const {
    hasError,
    error,
    form,
    isPending,
    generateInstructions,
    generatedText,
  } = useGenerateInstructionsForm(generateInstructionsPrompt);

  const { submitWithPiiCheck, isModalOpen, detectedPii, onContinue, onClose } = usePiiDetection();

  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (generatedText === null || pendingPrompt === null) {
      return;
    }

    newPrompt.setFieldValue('instructions', generatedText);
    setGenerateInstructionsPrompt(pendingPrompt);
    stepper.nextStep();
    setPendingPrompt(null);
  }, [generatedText, pendingPrompt, newPrompt, setGenerateInstructionsPrompt, stepper]);

  const handleSubmit = async (values: GeneratePromptInstructions) => {
    await submitWithPiiCheck(values.prompt, () => submitPrompt(values));
  };

  const submitPrompt = async (values: GeneratePromptInstructions) => {
    try {
      setPendingPrompt(values.prompt);
      await generateInstructions({ prompt: values.prompt });
    } catch (error) {
      setPendingPrompt(null);
      // Do nothing, the useGenerateInstructionsForm hook and
      // the PromptSubmissionErrorNotification will take care of
      // displaying the error.
    }
  };

  return (
    <form
      onSubmit={form.onSubmit(handleSubmit)}
    >
      <Box
        p='lg'
        bg='dark.6'
        sx={(theme) => ({
          borderTop: 'solid',
          borderTopColor: theme.colors.dark[4],
          borderTopWidth: 'thin',
        })}
      >
        <Text fz={'sm'} pb='md'>
          Example
        </Text>
        <Code
          tabIndex={0}
          aria-label='Example prompt'
          fz='sm'
          bg='dark.4'
          p='sm'
        >
          I need a prompt that will generate unit tests for the code
          provided by the user.
        </Code>
      </Box>

      <Textarea
        label='What would you like to generate a prompt for?'
        description='Provide a simple but descriptive input. We will use advanced prompt engineering techniques to enhance the prompt for optimal LLM performance.'
        descriptionProps={{ fz: 'xssm', c: 'gray.7' }}
        placeholder='Type your example here...'
        data-testid='instructions-prompt'
        autosize
        minRows={20}
        maxRows={20}
        p='xl'
        pt='md'
        bg='dark.6'
        mb='0'
        {...form.getInputProps('prompt')}
      />

      <Button
        mx='xl'
        my='lg'
        type='submit'
        data-testid='submit'
        loading={isPending}
        disabled={!form.isValid()}
      >
        {isPending ? 'Generating Prompt' : 'Generate Prompt'}
      </Button>

      <PromptSubmissionErrorNotification
        enabled={hasError}
        message={error?.message}
      />
      <PiiDetectionModal
        modalOpened={isModalOpen}
        closeModalHandler={onClose}
        onContinue={onContinue}
        piiMatches={detectedPii}
      />
    </form >
  );
}
