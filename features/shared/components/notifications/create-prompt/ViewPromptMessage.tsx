import { Button, Stack } from '@mantine/core';
import { useRouter } from 'next/router';
import { generatePromptUrl } from '@/features/shared/utils/prompt-helpers';
import { notifications } from '@mantine/notifications';

export interface ViewPromptMessageProps {
  title: string,
  promptId: string,
  notificationId: string,
};

export function ViewPromptMessage({ title, promptId, notificationId }: ViewPromptMessageProps) {
  const router = useRouter();
  return (title && promptId) ?
    <Stack align='flex-start'>
      You can now view your prompt in the prompt library
      <Button variant='outline' color='gray.0' size='xs' onClick={() => {
        router.push(generatePromptUrl(title, promptId));
        notifications.hide(notificationId);
      }}>
        View Prompt
      </Button>
    </Stack> : <>Something went wrong</>;
}
