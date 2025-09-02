import { render } from '@testing-library/react';
import PromptFormSubmission, { PromptFormSubmissionProps } from './PromptFormSubmission';
import { notifications } from '@mantine/notifications';
import { AiResponse } from '@/features/ai-provider/sources/types';
import { IconX } from '@tabler/icons-react';
import { promptSubmissionErrorTitle } from '../notifications/prompt-submission/PromptSubmissionErrorNotification';

jest.mock('@mantine/notifications');
describe('PromptFormSubmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const testErrorMessage: string = 'Test error message.';
  it('renders PromptSubmissionErrorNotification', () => {
    const props: PromptFormSubmissionProps = {
      hasPromptSubmissionError: true,
      errorMessage: testErrorMessage,
      isPending: false,
      data: undefined,
    };
    const { queryByTestId, container } = render(<PromptFormSubmission {...props} />);

    expect(notifications.show).toHaveBeenCalledWith({
      id: 'run-prompt-error',
      title: promptSubmissionErrorTitle,
      message: testErrorMessage,
      icon: <IconX />,
      autoClose: false,
      withCloseButton: true,
      variant: 'failed_operation',
    });
    expect(queryByTestId('prompt-form-submission-loading')).not.toBeInTheDocument();
    expect(queryByTestId('prompt_response')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
  it('renders PromptFormSubmissionLoading', () => {
    const props: PromptFormSubmissionProps = {
      hasPromptSubmissionError: false,
      errorMessage: testErrorMessage,
      isPending: true,
      data: undefined,
    };

    const { queryByTestId } = render(<PromptFormSubmission {...props} />);

    expect(queryByTestId('prompt-form-submission-loading')).toBeInTheDocument();
    expect(queryByTestId('prompt_response')).not.toBeInTheDocument();
    expect(notifications.show).not.toHaveBeenCalled();
  });
  it('rendersPromptFormSubmissionResponse', () => {
    const data: AiResponse = {
      text: 'This is a fake response',
      inputTokensUsed: 200,
      outputTokensUsed: 300,
    };

    const props: PromptFormSubmissionProps = {
      hasPromptSubmissionError: false,
      errorMessage: testErrorMessage,
      isPending: false,
      data: data,
    };

    const { queryByTestId } = render(<PromptFormSubmission {...props} />);

    expect(queryByTestId('prompt_response')).toBeInTheDocument();
    expect(queryByTestId('prompt-form-submission-loading')).not.toBeInTheDocument();
    expect(notifications.show).not.toHaveBeenCalled();

  });
  it('renders nothing if none of the conditions are met', () => {
    const props: PromptFormSubmissionProps = {
      hasPromptSubmissionError: false,
      errorMessage: testErrorMessage,
      isPending: false,
      data: undefined,
    };
    const { container } = render(<PromptFormSubmission {...props} />);

    expect(container).toBeEmptyDOMElement();
    expect(notifications.show).not.toHaveBeenCalled();
  });
});
