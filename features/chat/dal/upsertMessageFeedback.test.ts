import upsertMessageFeedback from './upsertMessageFeedback';
import db from '@/server/db';
import logger from '@/server/logger';
import { MessageFeedbackIssueType, MessageFeedbackRating } from '@/features/chat/types/message';

jest.mock('@/server/db', () => ({
  assistantChatMessageFeedback: {
    upsert: jest.fn(),
  },
}));

describe('upsertMessageFeedback DAL', () => {
  const mockMessageId = '550e8400-e29b-41d4-a716-446655440001';
  const mockUserId = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts a feedback row keyed on the message id', async () => {
    (db.assistantChatMessageFeedback.upsert as jest.Mock).mockResolvedValue({});

    await upsertMessageFeedback({
      messageId: mockMessageId,
      userId: mockUserId,
      rating: MessageFeedbackRating.Positive,
      comment: 'Great answer',
    });

    expect(db.assistantChatMessageFeedback.upsert).toHaveBeenCalledWith({
      where: { chatMessageId: mockMessageId },
      create: {
        chatMessageId: mockMessageId,
        userId: mockUserId,
        rating: MessageFeedbackRating.Positive,
        comment: 'Great answer',
        issueType: undefined,
      },
      update: {
        rating: MessageFeedbackRating.Positive,
        comment: 'Great answer',
        issueType: null,
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('stores a null comment and issue type when none is provided', async () => {
    (db.assistantChatMessageFeedback.upsert as jest.Mock).mockResolvedValue({});

    await upsertMessageFeedback({
      messageId: mockMessageId,
      userId: mockUserId,
      rating: MessageFeedbackRating.Negative,
    });

    expect(db.assistantChatMessageFeedback.upsert).toHaveBeenCalledWith({
      where: { chatMessageId: mockMessageId },
      create: {
        chatMessageId: mockMessageId,
        userId: mockUserId,
        rating: MessageFeedbackRating.Negative,
        comment: undefined,
        issueType: undefined,
      },
      update: {
        rating: MessageFeedbackRating.Negative,
        comment: null,
        issueType: null,
      },
    });
  });

  it('stores the issue type when provided', async () => {
    (db.assistantChatMessageFeedback.upsert as jest.Mock).mockResolvedValue({});

    await upsertMessageFeedback({
      messageId: mockMessageId,
      userId: mockUserId,
      rating: MessageFeedbackRating.Negative,
      comment: 'Missed the actual question',
      issueType: MessageFeedbackIssueType.NotFactuallyCorrect,
    });

    expect(db.assistantChatMessageFeedback.upsert).toHaveBeenCalledWith({
      where: { chatMessageId: mockMessageId },
      create: {
        chatMessageId: mockMessageId,
        userId: mockUserId,
        rating: MessageFeedbackRating.Negative,
        comment: 'Missed the actual question',
        issueType: MessageFeedbackIssueType.NotFactuallyCorrect,
      },
      update: {
        rating: MessageFeedbackRating.Negative,
        comment: 'Missed the actual question',
        issueType: MessageFeedbackIssueType.NotFactuallyCorrect,
      },
    });
  });

  it('throws a sanitized error and logs if the upsert fails', async () => {
    const rejectError = new Error('connection lost');
    (db.assistantChatMessageFeedback.upsert as jest.Mock).mockRejectedValueOnce(rejectError);

    await expect(upsertMessageFeedback({
      messageId: mockMessageId,
      userId: mockUserId,
      rating: MessageFeedbackRating.Positive,
    })).rejects.toThrow('Error saving message feedback');

    expect(logger.error).toHaveBeenCalledWith(
      `Error saving message feedback: MessageId: ${mockMessageId}`,
      rejectError,
    );
  });
});
