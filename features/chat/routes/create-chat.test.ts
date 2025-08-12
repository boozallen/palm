import { ContextType } from '@/server/trpc-context';
import { Model } from '@/features/shared/types/model';
import { OriginPrompt } from '@/features/chat/types/originPrompt';
import { Chat } from '@/features/chat/types/chat';
import chatRouter from '@/features/chat/routes';
import getModel from '@/features/shared/dal/getModel';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getOriginPrompt from '@/features/chat/dal/getOriginPrompt';
import createChat from '@/features/chat/dal/createChat';

jest.mock('@/features/shared/dal/getModel');
jest.mock('@/features/shared/dal/getSystemConfig');
jest.mock('@/features/chat/dal/getOriginPrompt');
jest.mock('@/features/chat/dal/createChat');

describe('create-chat route', () => {

  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockModelId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
  const mockPromptId = 'd7ad8ccf-ebfb-4acf-acd8-9d699dbc5d4d';
  const mockChatId = '7b91f044-da78-43d4-91aa-5fbeffcb3e75';

  const mockValidModel = {
    id: mockModelId,
  } as Model;

  const mockOriginPrompt: OriginPrompt = {
    id: mockPromptId,
    creatorId: null,
    title: 'Mock Origin Prompt',
    description: 'Prompt Description',
    instructions: 'Prompt Instructions',
    example: 'Mock Example',
  };

  const mockSystemConfig = {
    systemMessage: 'Configured Default System Message',
  };

  let mockInput: {
    modelId: string,
    promptId?: string | null,
    summary?: string | null,
    systemMessage?: string | null
  };
  let mockChat: Chat;

  const mockCtx = {
    userId: mockUserId,
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      modelId: mockModelId,
      promptId: mockPromptId,
    };

    mockChat = {
      id: mockChatId,
      userId: mockUserId,
      modelId: mockModelId,
      promptId: mockPromptId,
      summary: null,
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    };

    (getModel as jest.Mock).mockResolvedValue(mockValidModel);
    (getOriginPrompt as jest.Mock).mockResolvedValue(mockOriginPrompt);
    (getSystemConfig as jest.Mock).mockResolvedValue(mockSystemConfig);
  });

  it('creates a new Chat related to a Prompt', async () => {
    (createChat as jest.Mock).mockResolvedValue(mockChat);

    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.createChat(mockInput);

    expect(response).toEqual({
      chat: {
        ...mockChat,
      },
    });

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).toHaveBeenCalledWith(mockInput.promptId);
    expect(getSystemConfig).not.toHaveBeenCalled();
    expect(createChat).toHaveBeenCalledWith({
      userId: mockCtx.userId,
      modelId: mockInput.modelId,
      promptId: mockInput.promptId,
      systemMessage: mockOriginPrompt.instructions,
      summary: null,
    });
  });

  it('creates a new Chat NOT related to a Prompt', async () => {
    mockInput.promptId = null;
    mockChat.promptId = null;
    (createChat as jest.Mock).mockResolvedValue(mockChat);

    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.createChat(mockInput);

    expect(response).toEqual({
      chat: {
        ...mockChat,
      },
    });

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).not.toHaveBeenCalled();
    expect(getSystemConfig).toHaveBeenCalledWith();
    expect(createChat).toHaveBeenCalledWith({
      userId: mockCtx.userId,
      modelId: mockInput.modelId,
      promptId: mockInput.promptId,
      systemMessage: mockSystemConfig.systemMessage,
      summary: null,
    });
  });

  it('creates a new Chat NOT from a prompt with an empty string system message if the config is undefined', async () => {
    mockInput.promptId = null;
    mockChat.promptId = null;
    (getSystemConfig as jest.Mock).mockResolvedValue({});
    (createChat as jest.Mock).mockResolvedValue(mockChat);

    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.createChat(mockInput);

    expect(response).toEqual({
      chat: {
        ...mockChat,
      },
    });

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).not.toHaveBeenCalled();
    expect(getSystemConfig).toHaveBeenCalled();
    expect(createChat).toHaveBeenCalledWith({
      userId: mockCtx.userId,
      modelId: mockInput.modelId,
      promptId: mockInput.promptId,
      systemMessage: '',
      summary: null,
    });
  });

  it('creates a new Chat with a customized system message', async () => {
    const customInstructions = 'These are your custom instructions';
    mockInput.promptId = null;
    mockInput.systemMessage = customInstructions;
    mockChat.promptId = null;
    (createChat as jest.Mock).mockResolvedValue(mockChat);

    const caller = chatRouter.createCaller(mockCtx);
    const response = await caller.createChat(mockInput);

    expect(response).toEqual({
      chat: {
        ...mockChat,
      },
    });

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).not.toHaveBeenCalled();
    expect(getSystemConfig).not.toHaveBeenCalled();
    expect(createChat).toHaveBeenCalledWith({
      userId: mockCtx.userId,
      modelId: mockInput.modelId,
      promptId: mockInput.promptId,
      systemMessage: customInstructions,
      summary: null,
    });
  });

  it('throws an error if getModel fails', async () => {
    const mockError = new Error('Error getting model');
    (getModel as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockCtx);

    await expect(
      caller.createChat(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).not.toHaveBeenCalled();
    expect(getSystemConfig).not.toHaveBeenCalled();
    expect(createChat).not.toHaveBeenCalled();
  });

  it('throws an error if getOriginPrompt fails when a promptId is provided', async () => {
    const mockError = new Error('Error getting origin prompt');
    (getOriginPrompt as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockCtx);

    await expect(
      caller.createChat(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).toHaveBeenCalledWith(mockInput.promptId);
    expect(getSystemConfig).not.toHaveBeenCalled();
    expect(createChat).not.toHaveBeenCalled();
  });

  it('throws an error if getSystemConfig fails when a promptId is NOT provided', async () => {
    mockInput.promptId = null;
    const mockError = new Error('Error getting system config');
    (getSystemConfig as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockCtx);

    await expect(
      caller.createChat(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).not.toHaveBeenCalled();
    expect(getSystemConfig).toHaveBeenCalledWith();
    expect(createChat).not.toHaveBeenCalled();
  });

  it('throws an error if createChat fails', async () => {
    const mockError = new Error('Error creating chat');
    (createChat as jest.Mock).mockRejectedValue(mockError);

    const caller = chatRouter.createCaller(mockCtx);

    await expect(
      caller.createChat(mockInput)
    ).rejects.toThrow(mockError.message);

    expect(getModel).toHaveBeenCalledWith(mockInput.modelId);
    expect(getOriginPrompt).toHaveBeenCalledWith(mockInput.promptId);
    expect(getSystemConfig).not.toHaveBeenCalled();
    expect(createChat).toHaveBeenCalledWith({
      userId: mockCtx.userId,
      modelId: mockInput.modelId,
      promptId: mockInput.promptId,
      systemMessage: mockOriginPrompt.instructions,
      summary: null,
    });
  });

  it('rejects invalid input', async () => {
    mockInput.modelId = 'invalid-UUID';

    const caller = chatRouter.createCaller(mockCtx);

    await expect(
      caller.createChat(mockInput)
    ).rejects.toThrow();

    expect(getModel).not.toHaveBeenCalled();
    expect(getOriginPrompt).not.toHaveBeenCalled();
    expect(getSystemConfig).not.toHaveBeenCalled();
    expect(createChat).not.toHaveBeenCalled();
  });

});
