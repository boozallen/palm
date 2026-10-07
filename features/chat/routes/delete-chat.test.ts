import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Chat } from '@/features/chat/types/chat';
import chatRouter from '@/features/chat/routes';
import getChat from '@/features/chat/dal/getChat';
import deleteChat from '@/features/chat/dal/deleteChat';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import logger from '@/server/logger';

jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/deleteChat');

describe('delete-chat route', () => {

  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockOtherUserId = 'dc3cc2cf-c867-4a81-b940-d22d98544a0c';
  const mockChatId = 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4d';

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

    (getChat as jest.Mock).mockResolvedValue(mockChat);
    (deleteChat as jest.Mock).mockResolvedValue(undefined);
  });

  it('deletes a chat when the user owns it', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);
    const response = await caller.deleteChat({ chatId: mockChatId });

    expect(response).toEqual({ chatId: mockChatId });
    expect(deleteChat).toHaveBeenCalledWith(mockChatId, mockChat.userId);
  });

  it('deletes a chat when the user is an admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockAdminCtx);
    const response = await caller.deleteChat({ chatId: mockChatId });

    expect(response).toEqual({ chatId: mockChatId });
    expect(deleteChat).toHaveBeenCalledWith(mockChatId, mockOtherUserChat.userId);
  });

  // Deleting a chat is recorded in the audit log, naming the deleted chat.
  it('records an audit entry naming the deleted chat', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);
    await caller.deleteChat({ chatId: mockChatId });

    expect(mockUserCtx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.DeleteChat,
      description: `Chat ${mockChatId} was deleted`,
    });
  });

  it('throws Forbidden error when the user does not own the chat and is not admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteChat({ chatId: mockChatId })
    ).rejects.toThrow(Forbidden('You do not have permission to delete this chat'));

    expect(deleteChat).not.toHaveBeenCalled();
    expect(mockUserCtx.auditor.createAuditRecord).not.toHaveBeenCalled();
  });

  it('throws an error if getChat fails', async () => {
    const mockError = new Error('Error fetching chat');
    (getChat as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteChat({ chatId: mockChatId })
    ).rejects.toThrow(mockError.message);

    expect(deleteChat).not.toHaveBeenCalled();
    expect(mockUserCtx.auditor.createAuditRecord).not.toHaveBeenCalled();
  });

  it('rejects invalid chatId input', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.deleteChat({ chatId: 'invalid-uuid' })
    ).rejects.toThrow();

    expect(getChat).not.toHaveBeenCalled();
    expect(deleteChat).not.toHaveBeenCalled();
  });

});
