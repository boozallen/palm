import getChatMetadata from './getChatMetadata';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  chat: {
    findMany: jest.fn(),
  },
}));

describe('getChatMetadata DAL', () => {
  const mockUserId = '7435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockChatId = '6435b69e-3757-47a2-bacf-d4efdd85a32e';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty array without querying the database when no chat ids are given', async () => {
    const response = await getChatMetadata(mockUserId, []);

    expect(response).toEqual([]);
    expect(db.chat.findMany).not.toHaveBeenCalled();
  });

  it('maps model, agent provider, message count, and flattened artifacts for each chat', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        id: mockChatId,
        model: { name: 'GPT-4o' },
        agentProvider: null,
        _count: { messages: 4 },
        messages: [
          { chatArtifacts: [{ id: 'artifact-1', label: 'Report', fileExtension: '.md' }] },
          { chatArtifacts: [{ id: 'artifact-2', label: 'Chart', fileExtension: '.html' }] },
        ],
      },
    ]);

    const response = await getChatMetadata(mockUserId, [mockChatId]);

    expect(response).toEqual([
      {
        chatId: mockChatId,
        modelName: 'GPT-4o',
        agentProviderName: null,
        messageCount: 4,
        artifacts: [
          { id: 'artifact-1', label: 'Report', fileExtension: '.md' },
          { id: 'artifact-2', label: 'Chart', fileExtension: '.html' },
        ],
      },
    ]);

    expect(db.chat.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [mockChatId] },
        userId: mockUserId,
      },
      select: {
        id: true,
        model: { select: { name: true } },
        agentProvider: { select: { name: true } },
        _count: { select: { messages: true } },
        messages: {
          select: {
            chatArtifacts: {
              select: { id: true, label: true, fileExtension: true },
            },
          },
        },
      },
    });
  });

  it('logs and throws an error if the operation fails', async () => {
    const rejectError = new Error('Operation failed');
    (db.chat.findMany as jest.Mock).mockRejectedValue(rejectError);

    await expect(getChatMetadata(mockUserId, [mockChatId])).rejects.toThrow('Error fetching chat metadata');

    expect(logger.error).toHaveBeenCalledWith('Error fetching chat metadata from the database.', rejectError);
  });
});
