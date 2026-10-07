import deleteMessageFeedback from './deleteMessageFeedback';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  assistantChatMessageFeedback: {
    deleteMany: jest.fn(),
  },
}));

describe('deleteMessageFeedback DAL', () => {
  const mockMessageId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes the feedback row keyed on the message id', async () => {
    (db.assistantChatMessageFeedback.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await deleteMessageFeedback(mockMessageId);

    expect(db.assistantChatMessageFeedback.deleteMany).toHaveBeenCalledWith({
      where: { chatMessageId: mockMessageId },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('does not throw when no feedback row exists', async () => {
    (db.assistantChatMessageFeedback.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(deleteMessageFeedback(mockMessageId)).resolves.toBeUndefined();
  });

  it('throws a sanitized error and logs if the delete fails', async () => {
    const rejectError = new Error('connection lost');
    (db.assistantChatMessageFeedback.deleteMany as jest.Mock).mockRejectedValueOnce(rejectError);

    await expect(deleteMessageFeedback(mockMessageId)).rejects.toThrow('Error deleting message feedback');

    expect(logger.error).toHaveBeenCalledWith(
      `Error deleting message feedback: MessageId: ${mockMessageId}`,
      rejectError,
    );
  });
});
