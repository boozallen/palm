import updateChatConversationSummary from './updateChatConversationSummary';
import db from '@/server/db';
import logger from '@/server/logger';
import { Chat } from '@/features/chat/types/chat';

jest.mock('@/server/db', () => ({
  chat: {
    update: jest.fn(),
  },
}));

describe('updateChatConversationSummary DAL', () => {

  const mockInput = {
    id: 'aa356d1f-dd68-4f6b-82a9-ec9220973857',
    summary: 'New Summary',
  };

  const mockResolve: Chat = {
    id: mockInput.id,
    userId: 'ba356d1f-dd68-4f6b-82a9-ec9220973857',
    modelId: 'ca356d1f-dd68-4f6b-82a9-ec9220973857',
    promptId: 'da356d1f-dd68-4f6b-82a9-ec9220973857',
    summary: mockInput.summary,
    createdAt: new Date('2024-10-10T10:00:00.000Z'),
    updatedAt: new Date('2024-10-10T10:00:00.000Z'),
  };

  const mockError = new Error('Error updating chat conversation summary');
  const mockLogMsg = `Error updating chat conversation summary: ChatId: ${mockInput.id}`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a chat record with the given summary', async () => {
    (db.chat.update as jest.Mock).mockResolvedValue(mockResolve);

    const res = await updateChatConversationSummary(mockInput);
    expect(res).toEqual(mockResolve);

    expect(db.chat.update).toHaveBeenCalledWith({
      where: {
        id: mockInput.id,
      },
      data: {
        summary: mockInput.summary,
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('updates the chat summary as the current date if summary is null', async () => {
    const mockResolveWithDate = {
      ...mockResolve,
      summary: `Chat - ${new Date().toUTCString()}`,
    };
    (db.chat.update as jest.Mock).mockResolvedValue(mockResolveWithDate);

    const res = await updateChatConversationSummary({ ...mockInput, summary: null });
    expect(res).toEqual(mockResolveWithDate);

    expect(db.chat.update).toHaveBeenCalledWith({
      where: {
        id: mockInput.id,
      },
      data: {
        summary: `Chat - ${new Date().toUTCString()}`,
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the update operation fails', async () => {
    const rejectError = new Error('Failed to update');
    (db.chat.update as jest.Mock).mockRejectedValueOnce(rejectError);

    await expect(updateChatConversationSummary(mockInput)).rejects.toThrow(mockError);

    expect(db.chat.update).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(mockLogMsg, rejectError);
  });

});
