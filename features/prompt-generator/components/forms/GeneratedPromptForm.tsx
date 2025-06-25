import { Box, Button, createStyles, Textarea } from '@mantine/core';

import ContinueButton from '@/features/prompt-generator/components/buttons/ContinueButton';
import BackButton from '@/features/prompt-generator/components/buttons/BackButton';
import PromptFormSubmission from '@/features/shared/components/forms/PromptFormSubmission';
import { usePromptGenerator } from '@/features/prompt-generator/providers';
import InstructionsAndParameters from '@/features/shared/components/forms/inputs/InstructionsAndParameters';
import useRunPromptForm from '@/features/library/hooks/useRunPromptForm';

const useStyles = createStyles(() => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  },
}));

export default function GeneratedPromptForm() {
  const { classes } = useStyles();
  const { stepper, newPrompt } = usePromptGenerator();
  const {
    form,
    targetRef,
    handleSubmit,
    isPending,
    hasError,
    error,
    response,
  } = useRunPromptForm({
    initialValues: {
      example: newPrompt.values.example,
      instructions: newPrompt.values.instructions,
      config: newPrompt.values.config,
    },
  });

  const nextStep = () => {
    newPrompt.setValues({
      ...newPrompt.values,
      ...form.values,
    });

    stepper.nextStep();
  };

  return (
    <form
      className={classes.form}
      onSubmit={form.onSubmit(handleSubmit)}
    >
      <Box px='xl' py='md'>
        <BackButton onClick={stepper.previousStep} />
      </Box>

      <Textarea
        label='Test the Generated Prompt'
        description='
          Enter an example input here to test the generated prompt.
          This helps you see the accuracy of the output and make any necessary tweaks before saving the prompt.
          The example is stored along with the prompt so other users have a better understanding of how to use it.
        '
        descriptionProps={{ fz: 'xssm', c: 'gray.7' }}
        placeholder='Enter your input here to generate a response.'
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
      <Box>
        <InstructionsAndParameters form={form} />
        <Box px='xl' py='md' bg='dark.5'>
          <Button
            type='submit'
            data-testid='submit'
            loading={isPending}
          >
            {isPending ? 'Running Prompt' : 'Run Prompt to Test Output'}
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
        <Box px='xl' py='md'>
          <ContinueButton onClick={nextStep} disabled={!form.isValid()} />
        </Box>
      </Box>
    </form>
  );
};
