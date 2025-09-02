import { notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import PromptSubmissionErrorNotification, { promptSubmissionErrorTitle } from './PromptSubmissionErrorNotification';
import { IconX } from '@tabler/icons-react';

jest.mock('@mantine/notifications');

describe('PromptSubmissionErrorNotifications', () => {
  const testMessage = 'This is a test.';
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('displays mantine notification toast', () => {
    render(<PromptSubmissionErrorNotification message={testMessage} enabled={true}/>);

    expect(notifications.show).toHaveBeenCalledWith({
      id: 'run-prompt-error',
      title: promptSubmissionErrorTitle,
      message: testMessage,
      icon: <IconX />,
      autoClose: false,
      withCloseButton: true,
      variant: 'failed_operation',
    });
  });
  it('does not display notification toast if no submission error', () => {
    render(<PromptSubmissionErrorNotification message={testMessage} enabled={false}/>);
    expect(notifications.show).not.toHaveBeenCalled();
  });
});

