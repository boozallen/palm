import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Message, MessageRole } from '@/features/chat/types/message';
import { Chat } from '@/features/chat/types/chat';
import chatRouter from '@/features/chat/routes';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import deleteMessagesSince from '@/features/chat/dal/deleteMessagesSince';
import { BadRequest, Forbidden } from '@/features/shared/errors/routeErrors';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import logger from '@/server/logger';

jest.mock('@/features/chat/dal/getMessage');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/deleteMessagesSince');

describe('delete-message route', () => {

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

  const mockUserCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
    auditor: {
      createAuditRecord: jest.fn(),
    },
  } as unknown as ContextType;

  const mockAdminCtx = {
    userId: mockOtherUserId,
    userRole: UserRole.Admin,
    logger: logger,
    auditor: {
      createAuditRecord: jest.fn(),
    },
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getMessage as jest.Mock).mockResolvedValue(mockMessage);
    (getChat as jest.Mock).mockResolvedValue(mockChat);
    (deleteMessagesSince as jest.Mock).mockResolvedValue([mockMessageId]);
  });

  it('deletes a message and everything after it when the user owns the chat', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);
    const response = await caller.deleteMessage({ chatId: mockChatId, messageId: mockMessageId });

    expect(response).toEqual({ messageId: mockMessageId, messagedAt: mockMessage.createdAt });
    expect(deleteMessagesSince).toHaveBeenCalledWith(mockChatId, mockMessage.createdAt, mockChat.userId);
  });

  it('deletes a message when the user is an admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockAdminCtx);
    const response = await caller.deleteMessage({ chatId: mockChatId, messageId: mockMessageId });

    expect(response).toEqual({ messageId: mockMessageId, messagedAt: mockMessage.createdAt });
    expect(deleteMessagesSince).toHaveBeenCalledWith(mockChatId, mockMessage.createdAt, mockOtherUserChat.userId);
  });

  // Deleting a message is recorded in the audit log, naming how many messages the cascade removed.
  it('records an audit entry naming the deleted message and the size of the cascade', async () => {
    (deleteMessagesSince as jest.Mock).mockResolvedValue([mockMessageId, 'later-message-id']);

    const caller = chatRouter.createCaller(mockUserCtx);
    await caller.deleteMessage({ chatId: mockChatId, messageId: mockMessageId });

    expect(mockUserCtx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteMessage,
      description: `2 message(s) were deleted from chat ${mockChatId}, starting from message ${mockMessageId}`,
    });
  });

  it('throws Forbidden error when the user does not own the chat and is not admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessage({ chatId: mockChatId, messageId: mockMessageId })
    ).rejects.toThrow(Forbidden('You do not have permission to use this chat'));

    expect(deleteMessagesSince).not.toHaveBeenCalled();
    expect(mockUserCtx.auditor.createAuditRecord).not.toHaveBeenCalled();
  });

  it('throws BadRequest error when the message does not belong to the chat', async () => {
    (getMessage as jest.Mock).mockResolvedValue({ ...mockMessage, chatId: 'a-different-chat-id' });

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessage({ chatId: mockChatId, messageId: mockMessageId })
    ).rejects.toThrow(BadRequest('Message does not belong to chat'));

    expect(deleteMessagesSince).not.toHaveBeenCalled();
    expect(mockUserCtx.auditor.createAuditRecord).not.toHaveBeenCalled();
  });

  it('throws an error if getChat fails', async () => {
    const mockError = new Error('Error fetching chat');
    (getChat as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessage({ chatId: mockChatId, messageId: mockMessageId })
    ).rejects.toThrow(mockError.message);

    expect(getMessage).not.toHaveBeenCalled();
    expect(deleteMessagesSince).not.toHaveBeenCalled();
  });

  it('rejects invalid messageId input', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteMessage({ chatId: mockChatId, messageId: 'invalid-uuid' })
    ).rejects.toThrow();

    expect(getChat).not.toHaveBeenCalled();
    expect(getMessage).not.toHaveBeenCalled();
    expect(deleteMessagesSince).not.toHaveBeenCalled();
  });

});
