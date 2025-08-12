import { Chat } from '@/features/chat/types/chat';
import getChat from './getChat';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  chat: {
    findUnique: jest.fn(),
  },
}));

describe('getChat DAL', () => {

  const mockChatId = '7435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockChat: Chat = {
    id: mockChatId,
    userId: '6435b69e-3757-47a2-bacf-d4efdd85a32e',
    modelId: null,
    promptId: null,
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockError = new Error('Error fetching chat');
  const mockErrorLog = `Error fetching chat from the database. Id: ${mockChatId}`;
  const mockNotFoundError = new Error('Chat not found');
  const mockNotFoundLog = `Chat not found in the database. Id: ${mockChatId}`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches a chat by id', async () => {
    (db.chat.findUnique as jest.Mock).mockResolvedValue(mockChat);

    const response = await getChat(mockChatId);
    expect(response).toEqual(mockChat);

    expect(db.chat.findUnique).toHaveBeenCalledWith({
      where: { id: mockChatId },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and throws an error if the chat is not found', async () => {
    (db.chat.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getChat(mockChatId)).rejects.toThrow(mockNotFoundError);

    expect(logger.error).toHaveBeenCalledWith(mockNotFoundLog);
  });

  it('logs and throws an error if the operation fails', async () => {
    const rejectError = new Error('Operation failed');
    (db.chat.findUnique as jest.Mock).mockRejectedValue(rejectError);

    await expect(getChat(mockChatId)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(mockErrorLog, rejectError);
  });
});
