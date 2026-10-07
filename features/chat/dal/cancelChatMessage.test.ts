import cancelChatMessage from './cancelChatMessage';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  chatMessage: {
    update: jest.fn(),
  },
}));

describe('cancelChatMessage DAL', () => {
  const mockMessageId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets asyncChatStatus to CANCELLED', async () => {
    (db.chatMessage.update as jest.Mock).mockResolvedValue({});

    await cancelChatMessage(mockMessageId);

    expect(db.chatMessage.update).toHaveBeenCalledWith({
      where: { id: mockMessageId },
      data: { asyncChatStatus: 'cancelled' },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws a sanitized error and logs if the update fails', async () => {
    const rejectError = new Error('connection lost');
    (db.chatMessage.update as jest.Mock).mockRejectedValueOnce(rejectError);

    await expect(cancelChatMessage(mockMessageId)).rejects.toThrow('Error cancelling chat message');

    expect(logger.error).toHaveBeenCalledWith(
      `Error cancelling chat message: MessageId: ${mockMessageId}`,
      rejectError,
    );
  });
});
