import updateMessage from './updateMessage';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
  chatMessage: {
    update: jest.fn(),
  },
  chatArtifact: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  chatMessageFollowUp: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
}));

describe('updateMessage DAL', () => {

  const mockInput = {
    messageId: 'aa356d1f-dd68-4f6b-82a9-ec9220973857',
    content: 'Updated message content',
  };

  const mockError = new Error('Error updating message');
  const mockLogMsg = `Error updating message: MessageId: ${mockInput.messageId}`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a chat message with the given content', async () => {
    const mockTransaction = jest.fn().mockImplementation((callback) => callback({
      chatMessage: { update: jest.fn().mockResolvedValue({}) },
    }));
    (db.$transaction as jest.Mock).mockImplementation(mockTransaction);

    await updateMessage(mockInput);

    expect(db.$transaction).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the update operation fails', async () => {
    const rejectError = new Error('Failed to update');
    (db.$transaction as jest.Mock).mockRejectedValueOnce(rejectError);

    await expect(updateMessage(mockInput)).rejects.toThrow(mockError);

    expect(db.$transaction).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(mockLogMsg, rejectError);
  });

});
