import createChat from './createChat';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  chat: {
    create: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('createChat DAL', () => {
  const mockInput = {
    userId: 'user-id',
    modelId: 'model-id',
    promptId: 'prompt-id',
    agentProviderId: null,
    systemMessage: 'System instructions',
    summary: null,
    userGroupId: null,
  };

  const mockResult = {
    id: 'chat-id',
    summary: null,
    userId: mockInput.userId,
    modelId: mockInput.modelId,
    promptId: mockInput.promptId,
    agentProviderId: null,
    externalSessionId: null,
    userGroupId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a chat with a system message', async () => {
    (db.chat.create as jest.Mock).mockResolvedValue(mockResult);

    const result = await createChat(mockInput);

    expect(db.chat.create).toHaveBeenCalledWith({
      data: {
        summary: mockInput.summary,
        userId: mockInput.userId,
        modelId: mockInput.modelId,
        promptId: mockInput.promptId,
        agentProviderId: mockInput.agentProviderId,
        userGroupId: mockInput.userGroupId,
        messages: {
          create: {
            role: 'system',
            content: mockInput.systemMessage,
          },
        },
      },
    });
    expect(result).toEqual(mockResult);
  });

  it('persists the selected user group on the chat', async () => {
    (db.chat.create as jest.Mock).mockResolvedValue({ ...mockResult, userGroupId: 'group-1' });

    const result = await createChat({ ...mockInput, userGroupId: 'group-1' });

    expect(db.chat.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userGroupId: 'group-1' }),
    }));
    expect(result.userGroupId).toBe('group-1');
  });

  it('logs and throws an error if the operation fails', async () => {
    const rejectError = new Error('DB error');
    (db.chat.create as jest.Mock).mockRejectedValue(rejectError);

    await expect(createChat(mockInput)).rejects.toThrow('Error creating chat');

    expect(logger.error).toHaveBeenCalledWith(`Error creating chat: UserId: ${mockInput.userId}`, rejectError);
  });
});
