import { fireEvent, render, screen } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import RateChatMessage from './RateChatMessage';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useRateMessage from '@/features/chat/api/rate-message';
import useDeleteMessageFeedback from '@/features/chat/api/delete-message-feedback';
import { AuditRecordEvent, AuditRecordResourceType } from '@/features/shared/types/audit-record';
import { MessageFeedbackRating } from '@/features/chat/types/message';

const mockCreateAuditRecord = jest.fn();
const mockRateMessage = jest.fn();
const mockDeleteMessageFeedback = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}));

jest.mock('@/features/chat/api/rate-message');
jest.mock('@/features/chat/api/delete-message-feedback');

const SAVED_MUTATION_OPTIONS = expect.objectContaining({
  onSuccess: expect.any(Function),
  onError: expect.any(Function),
});

describe('RateChatMessage', () => {
  const mockChatId = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';
  const mockMessageId = 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b';

  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue({ chatId: mockChatId });
    mockRateMessage.mockImplementation((_variables, options) => options?.onSuccess?.());
    mockDeleteMessageFeedback.mockImplementation((_variables, options) => options?.onSuccess?.());
    (useRateMessage as jest.Mock).mockReturnValue({ mutate: mockRateMessage });
    (useDeleteMessageFeedback as jest.Mock).mockReturnValue({ mutate: mockDeleteMessageFeedback });
  });

  it('renders a thumbs up and thumbs down button', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    expect(screen.getByTestId('thumbs-up-button')).toBeInTheDocument();
    expect(screen.getByTestId('thumbs-down-button')).toBeInTheDocument();
  });

  it('starts with the previously saved rating already filled in', () => {
    render(
      <RateChatMessage
        messageId={mockMessageId}
        feedback={{ rating: MessageFeedbackRating.Positive, comment: null, issueType: null }}
      />
    );

    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('thumbs-down-button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the feedback modal when the thumbs up button is clicked', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));

    expect(screen.getByTestId('message-feedback-submit-button')).toBeInTheDocument();
    expect(screen.queryByTestId('message-feedback-issue-type')).not.toBeInTheDocument();
  });

  it('opens the feedback modal when the thumbs down button is clicked', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-down-button'));

    expect(screen.getByTestId('message-feedback-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('message-feedback-issue-type')).toBeInTheDocument();
  });

  it('records an audit event when the modal is opened', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.OpenMessageFeedbackModal,
      label: 'positive feedback for a chat response',
      metadata: {
        resourceType: AuditRecordResourceType.ChatMessage,
        resourceIds: [mockMessageId],
        chatMessageId: mockMessageId,
        chatId: mockChatId,
      },
    });
  });

  it('submits the rating with an empty comment', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(mockRateMessage).toHaveBeenCalledWith(
      { chatId: mockChatId, messageId: mockMessageId, rating: 'positive', comment: undefined },
      SAVED_MUTATION_OPTIONS
    );
  });

  it('submits the rating with a comment', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-down-button'));
    fireEvent.change(screen.getByTestId('message-feedback-comment'), {
      target: { value: 'Missed the actual question' },
    });
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(mockRateMessage).toHaveBeenCalledWith(
      { chatId: mockChatId, messageId: mockMessageId, rating: 'negative', comment: 'Missed the actual question' },
      SAVED_MUTATION_OPTIONS
    );
  });

  it('highlights the thumbs up icon after submitting a positive rating', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('thumbs-down-button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not highlight the thumb and shows a notification when the rating submission fails', () => {
    mockRateMessage.mockImplementation((_variables, options) => options?.onError?.());
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('aria-pressed', 'false');
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Rate Message Failed' })
    );
  });

  it('does not clear the thumb and shows a notification when clearing feedback fails', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    mockDeleteMessageFeedback.mockImplementation((_variables, options) => options?.onError?.());
    fireEvent.click(screen.getByTestId('thumbs-up-button'));

    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('aria-pressed', 'true');
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Clear Message Feedback Failed' })
    );
  });

  it('does not submit a rating when the modal is cancelled', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-cancel-button'));

    expect(mockRateMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId('thumbs-up-icon')).toBeInTheDocument();
  });

  it('records an audit event when the modal is cancelled', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    mockCreateAuditRecord.mockClear();
    fireEvent.click(screen.getByTestId('message-feedback-cancel-button'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.CancelMessageFeedbackModal,
      label: 'positive feedback for a chat response',
      metadata: {
        resourceType: AuditRecordResourceType.ChatMessage,
        resourceIds: [mockMessageId],
        chatMessageId: mockMessageId,
        chatId: mockChatId,
      },
    });
  });

  it('clears the rating when the already-active thumbs up button is clicked again', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));
    mockRateMessage.mockClear();
    mockCreateAuditRecord.mockClear();

    fireEvent.click(screen.getByTestId('thumbs-up-button'));

    expect(mockDeleteMessageFeedback).toHaveBeenCalledWith(
      { chatId: mockChatId, messageId: mockMessageId },
      SAVED_MUTATION_OPTIONS
    );
    expect(screen.getByTestId('thumbs-up-icon')).toBeInTheDocument();
    expect(mockRateMessage).not.toHaveBeenCalled();
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('clears the rating when the already-active thumbs down button is clicked again', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-down-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));
    mockRateMessage.mockClear();
    mockCreateAuditRecord.mockClear();

    fireEvent.click(screen.getByTestId('thumbs-down-button'));

    expect(mockDeleteMessageFeedback).toHaveBeenCalledWith(
      { chatId: mockChatId, messageId: mockMessageId },
      SAVED_MUTATION_OPTIONS
    );
    expect(screen.getByTestId('thumbs-down-icon')).toBeInTheDocument();
    expect(mockRateMessage).not.toHaveBeenCalled();
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('reopens the feedback modal to re-populate the rating after it was cleared', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));
    fireEvent.click(screen.getByTestId('thumbs-up-button'));

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a loading state on the thumbs up button while the rating is being submitted', () => {
    const { rerender } = render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));

    (useRateMessage as jest.Mock).mockReturnValue({ mutate: mockRateMessage, isPending: true });
    rerender(<RateChatMessage messageId={mockMessageId} />);

    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('data-loading', 'true');
    expect(screen.getByTestId('thumbs-down-button')).toBeDisabled();
  });

  it('shows a loading state on the thumbs up button while an active rating is being cleared', () => {
    (useDeleteMessageFeedback as jest.Mock).mockReturnValue({ mutate: mockDeleteMessageFeedback, isPending: true });
    render(
      <RateChatMessage
        messageId={mockMessageId}
        feedback={{ rating: MessageFeedbackRating.Positive, comment: null, issueType: null }}
      />
    );

    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('data-loading', 'true');
    expect(screen.getByTestId('thumbs-down-button')).toBeDisabled();
  });

  it('switches the active rating when the opposite thumb is submitted', () => {
    render(<RateChatMessage messageId={mockMessageId} />);

    fireEvent.click(screen.getByTestId('thumbs-up-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    fireEvent.click(screen.getByTestId('thumbs-down-button'));
    fireEvent.click(screen.getByTestId('message-feedback-submit-button'));

    expect(screen.getByTestId('thumbs-down-button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('thumbs-up-button')).toHaveAttribute('aria-pressed', 'false');
  });
});
