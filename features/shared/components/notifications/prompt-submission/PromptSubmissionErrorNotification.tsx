import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { useEffect } from 'react';

export const promptSubmissionErrorTitle = 'AI Response Error';
export const promptSubmissionErrorMessage = 'Unable to retrieve response from the AI provider. Please check that your API configuration is correct or try again later.';

type PromptSubmissionErrorNotificationProps = Readonly<{
  enabled: boolean
  message?: string,
}>;

export default function PromptSubmissionErrorNotification({ enabled, message }: PromptSubmissionErrorNotificationProps) {

  useEffect(() => {
    if (enabled) {
      notifications.show({
        id: 'run-prompt-error',
        title: promptSubmissionErrorTitle,
        message: message ?? promptSubmissionErrorMessage,
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  }, [enabled, message]);

  return null;
}
