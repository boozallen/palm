import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Message, MessageRole } from '@/features/chat/types/message';
import { Chat } from '@/features/chat/types/chat';
import chatRouter from '@/features/chat/routes';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import deleteMessageFeedback from '@/features/chat/dal/deleteMessageFeedback';
import { Forbidden } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/chat/dal/getMessage');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/deleteMessageFeedback');

describe('delete-message-feedback route', () => {

  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockOtherUserId = 'dc3cc2cf-c867-4a81-b940-d22d98544a0c';
  const mockMessageId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockChatId = 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4d';

  const mockMessage: Message = {
    id: mockMessageId,
    chatId: mockChatId,
    role: MessageRole.Assistant,
    content: 'Assistant response content',
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    documentIds: [],
    citations: [],
    artifacts: [],
    followUps: [],
    userChoices: [],
    deepResearch: false,
  };

  const mockChat: Chat = {
    id: mockChatId,
    userId: mockUserId,
    modelId: 'model-id',
    promptId: null,
    agentProviderId: null,
    summary: null,
    useCase: null,
    externalSessionId: null,
    userGroupId: null,
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
  };

  const mockOtherUserChat: Chat = {
    ...mockChat,
    userId: mockOtherUserId,
  };

  const mockInput = { chatId: mockChatId, messageId: mockMessageId };

  const mockUserCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: { error: jest.fn() },
    auditor: { createAuditRecord: jest.fn() },
  } as unknown as ContextType;

  const mockAdminCtx = {
    userId: mockOtherUserId,
    userRole: UserRole.Admin,
    logger: { error: jest.fn() },
    auditor: { createAuditRecord: jest.fn() },
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getMessage as jest.Mock).mockResolvedValue(mockMessage);
    (getChat as jest.Mock).mockResolvedValue(mockChat);
    (deleteMessageFeedback as jest.Mock).mockResolvedValue(undefined);
  });

  it('clears feedback when the user owns the chat', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);
    const response = await caller.deleteMessageFeedback(mockInput);

    expect(response).toEqual({ chatMessageId: mockMessageId });
    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(deleteMessageFeedback).toHaveBeenCalledWith(mockMessageId);
  });

  it('clears feedback when the user is admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockAdminCtx);
    const response = await caller.deleteMessageFeedback(mockInput);

    expect(response).toEqual({ chatMessageId: mockMessageId });
    expect(deleteMessageFeedback).toHaveBeenCalledWith(mockMessageId);
  });

  it('throws Forbidden error when user does not own the chat and is not admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessageFeedback(mockInput)
    ).rejects.toThrow(Forbidden('You do not have permission to clear feedback for this message'));

    expect(deleteMessageFeedback).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when the message is not from the assistant', async () => {
    (getMessage as jest.Mock).mockResolvedValue({ ...mockMessage, role: MessageRole.User });

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessageFeedback(mockInput)
    ).rejects.toThrow(Forbidden('You can only clear feedback on assistant messages'));

    expect(deleteMessageFeedback).not.toHaveBeenCalled();
  });

  it('throws an error if getMessage fails', async () => {
    const mockError = new Error('Error fetching message');
    (getMessage as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessageFeedback(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getChat).not.toHaveBeenCalled();
    expect(deleteMessageFeedback).not.toHaveBeenCalled();
  });

  it('throws an error if deleteMessageFeedback fails', async () => {
    const mockError = new Error('Error deleting message feedback');
    (deleteMessageFeedback as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessageFeedback(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(deleteMessageFeedback).toHaveBeenCalled();
  });

  it('rejects invalid messageId input', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessageFeedback({ chatId: mockChatId, messageId: 'invalid-uuid' })
    ).rejects.toThrow();

    expect(getMessage).not.toHaveBeenCalled();
    expect(deleteMessageFeedback).not.toHaveBeenCalled();
  });

});
