import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Message, MessageRole } from '@/features/chat/types/message';
import { Chat } from '@/features/chat/types/chat';
import chatRouter from '@/features/chat/routes';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import updateMessage from '@/features/chat/dal/updateMessage';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

jest.mock('@/features/chat/dal/getMessage');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/updateMessage');

describe('update-message route', () => {

  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockOtherUserId = 'dc3cc2cf-c867-4a81-b940-d22d98544a0c';
  const mockMessageId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockChatId = 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4d';

  const mockMessage: Message = {
    id: mockMessageId,
    chatId: mockChatId,
    role: MessageRole.User,
    content: 'Original message content',
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    citations: [],
    artifacts: [],
    followUps: [],
  };

  const mockChat: Chat = {
    id: mockChatId,
    userId: mockUserId,
    modelId: 'model-id',
    promptId: null,
    summary: null,
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
  };

  const mockOtherUserChat: Chat = {
    ...mockChat,
    userId: mockOtherUserId,
  };

  let mockInput: {
    messageId: string;
    content: string;
  };

  const mockUserCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
  } as unknown as ContextType;

  const mockAdminCtx = {
    userId: mockOtherUserId,
    userRole: UserRole.Admin,
    logger: logger,
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      messageId: mockMessageId,
      content: 'Updated message content',
    };

    (getMessage as jest.Mock).mockResolvedValue(mockMessage);
    (getChat as jest.Mock).mockResolvedValue(mockChat);
    (updateMessage as jest.Mock).mockResolvedValue(undefined);
  });

  it('successfully updates a message when user owns the chat', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);
    const response = await caller.updateMessage(mockInput);

    expect(response).toEqual({ content: 'Updated message content', chatMessageId: mockMessageId, chatId: mockChatId });

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(updateMessage).toHaveBeenCalledWith({
      messageId: mockInput.messageId,
      content: mockInput.content,
    });
  });

  it('successfully updates a message when user is admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockAdminCtx);
    const response = await caller.updateMessage(mockInput);

    expect(response).toEqual({ content: 'Updated message content', chatMessageId: mockMessageId, chatId: mockChatId });

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(updateMessage).toHaveBeenCalledWith({
      messageId: mockInput.messageId,
      content: mockInput.content,
    });
  });

  it('throws Forbidden error when user does not own the chat and is not admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.updateMessage(mockInput)
    ).rejects.toThrow(Forbidden('You do not have permission to edit this message'));

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(mockUserCtx.logger.error).toHaveBeenCalledWith(
      `You do not have permission to edit this message: userId: ${mockUserId}, messageId: ${mockMessageId}`
    );
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it('throws an error if getMessage fails', async () => {
    const mockError = new Error('Error fetching message');
    (getMessage as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.updateMessage(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).not.toHaveBeenCalled();
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it('throws an error if getChat fails', async () => {
    const mockError = new Error('Error fetching chat');
    (getChat as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.updateMessage(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it('throws an error if updateMessage fails', async () => {
    const mockError = new Error('Error updating message');
    (updateMessage as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.updateMessage(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(updateMessage).toHaveBeenCalledWith({
      messageId: mockInput.messageId,
      content: mockInput.content,
    });
  });

  it('rejects invalid messageId input', async () => {
    mockInput.messageId = 'invalid-uuid';

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.updateMessage(mockInput)
    ).rejects.toThrow();

    expect(getMessage).not.toHaveBeenCalled();
    expect(getChat).not.toHaveBeenCalled();
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it('rejects empty content input', async () => {
    mockInput.content = '';

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.updateMessage(mockInput)
    ).rejects.toThrow();

    expect(getMessage).not.toHaveBeenCalled();
    expect(getChat).not.toHaveBeenCalled();
    expect(updateMessage).not.toHaveBeenCalled();
  });

});
