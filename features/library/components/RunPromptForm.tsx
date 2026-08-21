import { Box, Button, Textarea } from '@mantine/core';

import PromptFormSubmission from '@/features/shared/components/forms/PromptFormSubmission';
import InstructionsAndParameters from '@/features/shared/components/forms/inputs/InstructionsAndParameters';
import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';
import { usePiiDetection } from '@/features/shared/hooks/piiDetection/usePiiDetection';
import PiiDetectionModal from '@/features/shared/components/modals/piiDetectionModal';

const RunPromptForm: React.FC = () => {
  const {
    form,
    response,
    isPending,
    hasError,
    error,
    targetRef,
    handleSubmit: originalHandleSubmit,
  } = usePromptDetails();

  const { submitWithPiiCheck, isModalOpen, detectedPii, onContinue, onClose } = usePiiDetection();

  const handleSubmit = async (values: any) => {
    // Check PII in the combined text that will actually be sent to the LLM
    const promptContent = `${values.instructions}\n\n${values.example}`;
    await submitWithPiiCheck(promptContent, () => originalHandleSubmit(values));
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Textarea
        label='Prompt example'
        placeholder='Enter your example here to generate a response.'
        autosize
        minRows={15}
        maxRows={15}
        p='xl'
        pt='md'
        bg='dark.4'
        mb='0'
        {...form.getInputProps('example')}
        error={!form.isValid('example')}
      />
      <InstructionsAndParameters form={form} />
      <Box px='xl' py='md' bg='dark.4'>
        <Button
          type='submit'
          loading={isPending}
          data-testid='Submit'
        >
          {isPending ? 'Running Prompt' : 'Run Prompt'}
        </Button>
      </Box>
      <Box ref={targetRef}>
        <PromptFormSubmission
          hasPromptSubmissionError={hasError}
          errorMessage={error?.message}
          isPending={isPending}
          data={response}
        />
      </Box>
      <PiiDetectionModal
        modalOpened={isModalOpen}
        closeModalHandler={onClose}
        onContinue={onContinue}
        piiMatches={detectedPii}
      />
    </form>
  );
};

export default RunPromptForm;
