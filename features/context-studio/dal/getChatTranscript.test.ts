import getChatTranscript from '@/features/context-studio/dal/getChatTranscript';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatMessage: { findMany: jest.fn() },
    aiProviderUsage: { findMany: jest.fn() },
  },
}));

const findMessages = db.chatMessage.findMany as jest.Mock;
const findUsage = db.aiProviderUsage.findMany as jest.Mock;

describe('getChatTranscript', () => {
  beforeEach(() => {
    findMessages.mockReset();
    findUsage.mockReset();
  });

  it('returns the conversation in order with each message its step costs', async () => {
    findMessages.mockResolvedValue([
      { id: 'msg-1', role: 'user', content: 'What is in scope?', createdAt: new Date('2026-09-01T10:00:00Z') },
      { id: 'msg-2', role: 'assistant', content: 'Here is the boundary.', createdAt: new Date('2026-09-01T10:00:20Z') },
    ]);
    findUsage.mockResolvedValue([
      { chatMessageId: 'msg-2', stepLabel: 'completion', inputTokensUsed: 100, costPerInputToken: 0.01, outputTokensUsed: 50, costPerOutputToken: 0.02 },
    ]);

    const transcript = await getChatTranscript('chat-1', 'all');

    expect(transcript.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(transcript[1].usageSteps).toEqual([{ stepLabel: 'completion', cost: 2, tokens: 150 }]);
  });

  it('leaves usage steps empty for a message with no recorded spend', async () => {
    findMessages.mockResolvedValue([
      { id: 'msg-1', role: 'user', content: 'hi', createdAt: new Date('2026-09-01T10:00:00Z') },
    ]);
    findUsage.mockResolvedValue([]);

    const transcript = await getChatTranscript('chat-1', 'all');

    expect(transcript[0].usageSteps).toEqual([]);
  });

  it('excludes unattributed usage steps when no group is selected', async () => {
    findMessages.mockResolvedValue([
      { id: 'msg-1', role: 'assistant', content: 'hi', createdAt: new Date('2026-09-01T10:00:00Z') },
    ]);
    findUsage.mockResolvedValue([]);

    await getChatTranscript('chat-1', 'all');

    expect(findUsage).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userGroupId: { not: null } }),
    }));
  });

  it('keeps unattributed usage steps when a specific group is selected', async () => {
    findMessages.mockResolvedValue([
      { id: 'msg-1', role: 'assistant', content: 'hi', createdAt: new Date('2026-09-01T10:00:00Z') },
    ]);
    findUsage.mockResolvedValue([
      { chatMessageId: 'msg-1', stepLabel: 'completion', inputTokensUsed: 100, costPerInputToken: 0.01, outputTokensUsed: 50, costPerOutputToken: 0.02 },
    ]);

    const transcript = await getChatTranscript('chat-1', 'group-1');

    expect(findUsage).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ userGroupId: { not: null } }),
    }));
    expect(transcript[0].usageSteps).toEqual([{ stepLabel: 'completion', cost: 2, tokens: 150 }]);
  });

  it('throws a sanitized error when the read fails', async () => {
    findMessages.mockRejectedValue(new Error('connection lost'));

    await expect(getChatTranscript('chat-1', 'all')).rejects.toThrow('Failed to fetch chat transcript');
  });
});
