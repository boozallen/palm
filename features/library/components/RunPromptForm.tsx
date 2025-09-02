import { Box, Button, Textarea } from '@mantine/core';

import PromptFormSubmission from '@/features/shared/components/forms/PromptFormSubmission';
import InstructionsAndParameters from '@/features/shared/components/forms/inputs/InstructionsAndParameters';
import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';

const RunPromptForm: React.FC = () => {
  const {
    form,
    response,
    isPending,
    hasError,
    error,
    targetRef,
    handleSubmit,
  } = usePromptDetails();

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
        bg='dark.5'
        mb='0'
        {...form.getInputProps('example')}
        error={!form.isValid('example')}
      />
      <InstructionsAndParameters form={form} />
      <Box px='xl' py='md' bg='dark.5'>
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
    </form>
  );
};

export default RunPromptForm;
