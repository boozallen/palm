import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { Message, MessageRole, MessageFeedbackIssueType, MessageFeedbackRating } from '@/features/chat/types/message';
import { Chat } from '@/features/chat/types/chat';
import chatRouter from '@/features/chat/routes';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import upsertMessageFeedback from '@/features/chat/dal/upsertMessageFeedback';
import { Forbidden } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/chat/dal/getMessage');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/upsertMessageFeedback');

describe('rate-message route', () => {

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

  let mockInput: {
    chatId: string;
    messageId: string;
    rating: MessageFeedbackRating;
    comment?: string;
    issueType?: MessageFeedbackIssueType;
  };

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

    mockInput = {
      chatId: mockChatId,
      messageId: mockMessageId,
      rating: MessageFeedbackRating.Positive,
    };

    (getMessage as jest.Mock).mockResolvedValue(mockMessage);
    (getChat as jest.Mock).mockResolvedValue(mockChat);
    (upsertMessageFeedback as jest.Mock).mockResolvedValue(undefined);
  });

  it('successfully rates a message when user owns the chat', async () => {
    mockInput.comment = 'Very helpful';

    const caller = chatRouter.createCaller(mockUserCtx);
    const response = await caller.rateMessage(mockInput);

    expect(response).toEqual({
      chatMessageId: mockMessageId,
      rating: MessageFeedbackRating.Positive,
      comment: 'Very helpful',
      issueType: null,
    });

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(upsertMessageFeedback).toHaveBeenCalledWith({
      messageId: mockMessageId,
      userId: mockUserId,
      rating: MessageFeedbackRating.Positive,
      comment: 'Very helpful',
    });
  });

  it('passes through an issue type for a negative rating', async () => {
    mockInput.rating = MessageFeedbackRating.Negative;
    mockInput.issueType = MessageFeedbackIssueType.NotFactuallyCorrect;

    const caller = chatRouter.createCaller(mockUserCtx);
    const response = await caller.rateMessage(mockInput);

    expect(response).toEqual({
      chatMessageId: mockMessageId,
      rating: MessageFeedbackRating.Negative,
      comment: null,
      issueType: MessageFeedbackIssueType.NotFactuallyCorrect,
    });

    expect(upsertMessageFeedback).toHaveBeenCalledWith({
      messageId: mockMessageId,
      userId: mockUserId,
      rating: MessageFeedbackRating.Negative,
      comment: undefined,
      issueType: MessageFeedbackIssueType.NotFactuallyCorrect,
    });
  });

  it('submits with no comment', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);
    const response = await caller.rateMessage(mockInput);

    expect(response).toEqual({
      chatMessageId: mockMessageId,
      rating: MessageFeedbackRating.Positive,
      comment: null,
      issueType: null,
    });

    expect(upsertMessageFeedback).toHaveBeenCalledWith({
      messageId: mockMessageId,
      userId: mockUserId,
      rating: MessageFeedbackRating.Positive,
      comment: undefined,
    });
  });

  it('successfully rates a message when user is admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockAdminCtx);
    const response = await caller.rateMessage(mockInput);

    expect(response).toEqual({
      chatMessageId: mockMessageId,
      rating: MessageFeedbackRating.Positive,
      comment: null,
      issueType: null,
    });

    expect(upsertMessageFeedback).toHaveBeenCalledWith({
      messageId: mockMessageId,
      userId: mockOtherUserId,
      rating: MessageFeedbackRating.Positive,
      comment: undefined,
    });
  });

  it('throws Forbidden error when user does not own the chat and is not admin', async () => {
    (getChat as jest.Mock).mockResolvedValue(mockOtherUserChat);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.rateMessage(mockInput)
    ).rejects.toThrow(Forbidden('You do not have permission to rate this message'));

    expect(getMessage).toHaveBeenCalledWith(mockInput.messageId);
    expect(getChat).toHaveBeenCalledWith(mockMessage.chatId);
    expect(upsertMessageFeedback).not.toHaveBeenCalled();
  });

  it('throws Forbidden error when the message is not from the assistant', async () => {
    (getMessage as jest.Mock).mockResolvedValue({ ...mockMessage, role: MessageRole.User });

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.rateMessage(mockInput)
    ).rejects.toThrow(Forbidden('You can only rate assistant messages'));

    expect(upsertMessageFeedback).not.toHaveBeenCalled();
  });

  it('throws an error if getMessage fails', async () => {
    const mockError = new Error('Error fetching message');
    (getMessage as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.rateMessage(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getChat).not.toHaveBeenCalled();
    expect(upsertMessageFeedback).not.toHaveBeenCalled();
  });

  it('throws an error if upsertMessageFeedback fails', async () => {
    const mockError = new Error('Error saving message feedback');
    (upsertMessageFeedback as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.rateMessage(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(upsertMessageFeedback).toHaveBeenCalled();
  });

  it('rejects invalid messageId input', async () => {
    mockInput.messageId = 'invalid-uuid';

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.rateMessage(mockInput)
    ).rejects.toThrow();

    expect(getMessage).not.toHaveBeenCalled();
    expect(upsertMessageFeedback).not.toHaveBeenCalled();
  });

  it('rejects a comment over the length limit', async () => {
    mockInput.comment = 'a'.repeat(2001);

    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.rateMessage(mockInput)
    ).rejects.toThrow();

    expect(getMessage).not.toHaveBeenCalled();
    expect(upsertMessageFeedback).not.toHaveBeenCalled();
  });

  it('rejects an invalid rating value', async () => {
    const caller = chatRouter.createCaller(mockUserCtx);

    await expect(
      caller.rateMessage({ ...mockInput, rating: 'sideways' as MessageFeedbackRating })
    ).rejects.toThrow();

    expect(getMessage).not.toHaveBeenCalled();
    expect(upsertMessageFeedback).not.toHaveBeenCalled();
  });

});
