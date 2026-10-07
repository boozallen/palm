import { Chat } from '@/features/chat/types/chat';
import { Message, MessageRole } from '@/features/chat/types/message';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { AIFactory } from '@/features/ai-provider';
import chatRouter from '@/features/chat/routes';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import updateChatConversationSummary from '@/features/chat/dal/updateChatConversationSummary';
import generateChatConversationSummary from '@/features/chat/system-ai/generateChatConversationSummary';

jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/getMessages');
jest.mock('@/features/chat/dal/updateChatConversationSummary');
jest.mock('@/features/chat/system-ai/generateChatConversationSummary');
jest.mock('@/features/ai-provider');

describe('update-chat-conversation-summary route', () => {

  const mockUserId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockChatId = 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4d';

  const mockGeneratedSummary = 'AI Generated Summary';
  const mockGeneratedUseCase = 'Engineering';
  const mockFallbackSummary = `Chat - ${new Date('2024-04-04T00:00:00.000Z')}`;

  const mockUnauthorized = Unauthorized('You do not have permission to access this resource');

  const mockMessages: Message[] = [
    {
      id: 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4d',
      chatId: mockChatId,
      role: MessageRole.System,
      content: 'System Message',
      createdAt: new Date(),
      documentIds: [],
      citations: [],
      artifacts: [],
      followUps: [],
      userChoices: [],
      deepResearch: false,
    },
    {
      id: 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4c',
      chatId: mockChatId,
      role: MessageRole.User,
      content: 'User Message',
      createdAt: new Date(),
      documentIds: [],
      citations: [],
      artifacts: [],
      followUps: [],
      userChoices: [],
      deepResearch: false,
    },
    {
      id: 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4b',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'Assistant Message',
      createdAt: new Date(),
      documentIds: [],
      citations: [],
      artifacts: [],
      followUps: [],
      userChoices: [],
      deepResearch: false,
    },
  ];

  const mockInputWithMessages = {
    chatId: mockChatId,
    messages: mockMessages.slice(1).map(({ role, content, createdAt }) => ({
      role,
      content,
      messagedAt: createdAt.toISOString(),
    })),
  };

  const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';

  let mockCtx: ContextType;
  let mockSummaryResponse: { summary: string | null, useCase: string | null };
  let mockUpdatedChat: Chat;
  let mockSystemConfig: { featureManagementChatSummarization: boolean | undefined };
  let mockChat: Chat;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCtx = {
      ai: jest.fn(),
      userId: mockUserId,
    } as unknown as ContextType;

    mockSummaryResponse = {
      summary: mockGeneratedSummary,
      useCase: mockGeneratedUseCase,
    };

    mockUpdatedChat = {
      id: mockChatId,
      userId: mockUserId,
      modelId: 'test-model',
      promptId: 'test-prompt',
      agentProviderId: null,
      summary: mockGeneratedSummary,
      useCase: mockGeneratedUseCase,
      externalSessionId: null,
      userGroupId: mockUserGroupId,
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    };

    mockChat = { ...mockUpdatedChat, summary: null, useCase: null };

    mockSystemConfig = {
      featureManagementChatSummarization: true,
    };

    (getSystemConfig as jest.Mock).mockResolvedValue(mockSystemConfig);
    (getChat as jest.Mock).mockResolvedValue(mockChat);
    (generateChatConversationSummary as jest.Mock).mockResolvedValue(mockSummaryResponse);
    (updateChatConversationSummary as jest.Mock).mockResolvedValue(mockUpdatedChat);
  });

  it('updates a Chat with an AI summary using the input messages', async () => {
    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.updateChatConversationSummary(mockInputWithMessages);

    expect(response).toEqual({
      summary: mockGeneratedSummary,
      useCase: mockGeneratedUseCase,
    });

    expect(getSystemConfig).toHaveBeenCalledWith();
    expect(getChat).toHaveBeenCalledWith(mockInputWithMessages.chatId);
    expect(AIFactory).toHaveBeenCalledWith({ userId: mockUserId, userGroupId: mockUserGroupId });
    expect(getMessages).not.toHaveBeenCalled();
    expect(generateChatConversationSummary).toHaveBeenCalledWith(expect.any(AIFactory), mockInputWithMessages.messages);
    expect(updateChatConversationSummary).toHaveBeenCalledWith({
      id: mockInputWithMessages.chatId,
      summary: mockSummaryResponse.summary,
      useCase: mockSummaryResponse.useCase,
    });
  });

  it('updates a Chat with an AI summary using messages from getMessages DAL when input has no messages', async () => {
    (getMessages as jest.Mock).mockResolvedValue(mockMessages);

    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.updateChatConversationSummary({ chatId: mockChatId });

    expect(response).toEqual({
      summary: mockGeneratedSummary,
      useCase: mockGeneratedUseCase,
    });

    expect(getSystemConfig).toHaveBeenCalledWith();
    expect(getMessages).toHaveBeenCalledWith(mockChatId);
    expect(generateChatConversationSummary).toHaveBeenCalledWith(expect.any(AIFactory), mockMessages.map((message) => {
      return {
        role: message.role,
        content: message.content,
        messagedAt: message.createdAt.toISOString(),
      };
    }));
    expect(updateChatConversationSummary).toHaveBeenCalledWith({
      id: mockChatId,
      summary: mockSummaryResponse.summary,
      useCase: mockSummaryResponse.useCase,
    });
  });

  it('updates a Chat with a null summary and useCase if generateChatConversationSummary returned null', async () => {
    mockSummaryResponse.summary = null;
    mockSummaryResponse.useCase = null;
    mockUpdatedChat.summary = mockFallbackSummary;
    mockUpdatedChat.useCase = null;

    (generateChatConversationSummary as jest.Mock).mockResolvedValue(mockSummaryResponse);
    (updateChatConversationSummary as jest.Mock).mockResolvedValue(mockUpdatedChat);

    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.updateChatConversationSummary(mockInputWithMessages);

    expect(response).toEqual({
      summary: mockFallbackSummary,
      useCase: null,
    });

    expect(getSystemConfig).toHaveBeenCalledWith();
    expect(getMessages).not.toHaveBeenCalled();
    expect(generateChatConversationSummary).toHaveBeenCalledWith(expect.any(AIFactory), mockInputWithMessages.messages);
    expect(updateChatConversationSummary).toHaveBeenCalledWith({
      id: mockInputWithMessages.chatId,
      summary: mockSummaryResponse.summary,
      useCase: mockSummaryResponse.useCase,
    });
  });

  it('throws an error if updateChatConversationSummary DAL fails', async () => {
    const mockError = new Error('Error updating chat summary');

    (updateChatConversationSummary as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockCtx);

    await expect(
      caller.updateChatConversationSummary(mockInputWithMessages)
    ).rejects.toThrow(mockError.message);

    expect(getSystemConfig).toHaveBeenCalled();
    expect(getMessages).not.toHaveBeenCalled();
    expect(generateChatConversationSummary).toHaveBeenCalled();
    expect(updateChatConversationSummary).toHaveBeenCalled();
  });

  it('throws an Unauthorized error if no user session', async () => {
    mockCtx = {
      userId: null,
    } as unknown as ContextType;

    const caller = chatRouter.createCaller(mockCtx);

    await expect(
      caller.updateChatConversationSummary(mockInputWithMessages)
    ).rejects.toThrow(mockUnauthorized);

    expect(getSystemConfig).not.toHaveBeenCalled();
    expect(getMessages).not.toHaveBeenCalled();
    expect(generateChatConversationSummary).not.toHaveBeenCalled();
    expect(updateChatConversationSummary).not.toHaveBeenCalled();
  });

  it('does NOT generate an AI summary or useCase if featureManagementChatSummarization is OFF', async () => {
    mockSystemConfig.featureManagementChatSummarization = false;
    mockUpdatedChat.summary = mockFallbackSummary;
    mockUpdatedChat.useCase = null;

    (getSystemConfig as jest.Mock).mockResolvedValue(mockSystemConfig);
    (updateChatConversationSummary as jest.Mock).mockResolvedValue(mockUpdatedChat);

    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.updateChatConversationSummary(mockInputWithMessages);

    expect(response).toEqual({
      summary: mockUpdatedChat.summary,
      useCase: null,
    });

    expect(getSystemConfig).toHaveBeenCalled();
    expect(getChat).not.toHaveBeenCalled();
    expect(getMessages).not.toHaveBeenCalled();
    expect(generateChatConversationSummary).not.toHaveBeenCalled();
    expect(updateChatConversationSummary).toHaveBeenCalledWith({
      id: mockInputWithMessages.chatId,
      summary: null,
      useCase: null,
    });
  });

  it('passes undefined to the AI factory when the chat has no user group', async () => {
    mockChat.userGroupId = null;

    (getChat as jest.Mock).mockResolvedValue(mockChat);

    const caller = chatRouter.createCaller(mockCtx);
    await caller.updateChatConversationSummary(mockInputWithMessages);

    expect(getChat).toHaveBeenCalledWith(mockInputWithMessages.chatId);
    expect(AIFactory).toHaveBeenCalledWith({ userId: mockUserId, userGroupId: undefined });
  });

});
