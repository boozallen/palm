import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import MessageFeedbackModal from './MessageFeedbackModal';
import { MessageFeedbackIssueType, MessageFeedbackRating } from '@/features/chat/types/message';

describe('MessageFeedbackModal', () => {
  const onClose = jest.fn();
  const onSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no rating is pending', () => {
    const { container } = render(
      <MessageFeedbackModal opened={false} rating={null} onClose={onClose} onSubmit={onSubmit} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders positive-feedback copy for a positive rating', () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Positive} onClose={onClose} onSubmit={onSubmit} />
    );

    expect(screen.getByTestId('message-feedback-title')).toHaveTextContent('Give positive feedback');
    expect(screen.getByPlaceholderText('What was helpful about this response?')).toBeInTheDocument();
  });

  it('renders negative-feedback copy for a negative rating', () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Negative} onClose={onClose} onSubmit={onSubmit} />
    );

    expect(screen.getByTestId('message-feedback-title')).toHaveTextContent('Give negative feedback');
    expect(screen.getByPlaceholderText('What could be improved about this response?')).toBeInTheDocument();
  });

  it('does not render the issue type select for a positive rating', () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Positive} onClose={onClose} onSubmit={onSubmit} />
    );

    expect(screen.queryByTestId('message-feedback-issue-type')).not.toBeInTheDocument();
  });

  it('renders the issue type select for a negative rating', () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Negative} onClose={onClose} onSubmit={onSubmit} />
    );

    expect(screen.getByTestId('message-feedback-issue-type')).toBeInTheDocument();
  });

  it('submits an empty comment when none is entered', () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Positive} onClose={onClose} onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(onSubmit).toHaveBeenCalledWith('', undefined);
  });

  it('submits the entered comment', () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Positive} onClose={onClose} onSubmit={onSubmit} />
    );

    fireEvent.change(screen.getByTestId('message-feedback-comment'), {
      target: { value: 'This was great' },
    });
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(onSubmit).toHaveBeenCalledWith('This was great', undefined);
  });

  it('submits the selected issue type with a negative rating', async () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Negative} onClose={onClose} onSubmit={onSubmit} />
    );

    fireEvent.mouseDown(screen.getByTestId('message-feedback-issue-type'));
    const notFactuallyCorrectOption = `message-feedback-issue-option-${MessageFeedbackIssueType.NotFactuallyCorrect}`;
    await waitFor(() => {
      expect(screen.getByTestId(notFactuallyCorrectOption)).toBeInTheDocument();
    });
    fireEvent.mouseDown(screen.getByTestId(notFactuallyCorrectOption));
    fireEvent.change(screen.getByTestId('message-feedback-comment'), {
      target: { value: 'Missed the actual question' },
    });
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(onSubmit).toHaveBeenCalledWith(
      'Missed the actual question',
      MessageFeedbackIssueType.NotFactuallyCorrect
    );
  });

  it('calls onClose when cancel is clicked', () => {
    render(
      <MessageFeedbackModal opened rating={MessageFeedbackRating.Positive} onClose={onClose} onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByTestId('message-feedback-cancel-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
