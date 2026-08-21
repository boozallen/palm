import { Paper, Skeleton } from '@mantine/core';

export default function PromptFormSubmissionLoading() {

  return (
    <Paper px='xl' py='md' data-testid='prompt-form-submission-loading'>
      <Skeleton height={12} radius='xs' mt='sm' />
      <Skeleton height={12} radius='xs' mt='sm' />
      <Skeleton height={12} radius='xs' mt='sm' />
      <Skeleton height={12} radius='xs' mt='sm' />
    </Paper>
  );
}
