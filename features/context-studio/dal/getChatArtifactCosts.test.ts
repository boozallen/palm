import db from '@/server/db';
import logger from '@/server/logger';
import getChatArtifactCosts from './getChatArtifactCosts';

jest.mock('@/server/db', () => ({
  chat: {
    findMany: jest.fn(),
  },
  chatArtifact: {
    findMany: jest.fn(),
  },
  chatMessageCitation: {
    findMany: jest.fn(),
  },
  aiProviderUsage: {
    findMany: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('getChatArtifactCosts', () => {
  const mockChat = {
    id: 'chat-1',
    messages: [
      { id: 'msg-user', role: 'user', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'msg-assistant', role: 'assistant', createdAt: new Date('2026-01-01T00:01:00Z') },
    ],
  };

  const mockArtifact = {
    id: 'artifact-1',
    label: 'Report',
    fileExtension: '.html',
    chatMessageId: 'msg-assistant',
    message: { chatId: 'chat-1' },
  };

  const usageRow = (overrides: Record<string, unknown> = {}) => ({
    chatMessageId: 'msg-assistant',
    embedding: false,
    inputTokensUsed: 1000,
    costPerInputToken: 0.00001,
    outputTokensUsed: 500,
    costPerOutputToken: 0.00002,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (db.chat.findMany as jest.Mock).mockResolvedValue([mockChat]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([mockArtifact]);
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValue([]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow()]);
  });

  it('should return an empty map without querying for no chat ids', async () => {
    const result = await getChatArtifactCosts([]);

    expect(result.size).toBe(0);
    expect(db.chat.findMany).not.toHaveBeenCalled();
  });

  it('should attribute the generating message spend to its artifact', async () => {
    const result = await getChatArtifactCosts(['chat-1']);

    // 1000 * 0.00001 + 500 * 0.00002 = 0.02
    expect(result.get('artifact-1')).toEqual({
      artifactId: 'artifact-1',
      chatId: 'chat-1',
      name: 'Report.html',
      cost: 0.02,
      tokens: 1500,
      cumulativeCost: 0.02,
      cumulativeTokens: 1500,
    });
  });

  it('should split cost across artifacts from the same message but not divide cumulative cost', async () => {
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      mockArtifact,
      { ...mockArtifact, id: 'artifact-2' },
    ]);

    const result = await getChatArtifactCosts(['chat-1']);

    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.01);
    expect(result.get('artifact-2')?.cost).toBeCloseTo(0.01);
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.02);
    expect(result.get('artifact-2')?.cumulativeCost).toBeCloseTo(0.02);
  });

  it('should report null cost rather than zero when no usage is attributable', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getChatArtifactCosts(['chat-1']);

    expect(result.get('artifact-1')?.cost).toBeNull();
    expect(result.get('artifact-1')?.tokens).toBeNull();
    expect(result.get('artifact-1')?.cumulativeCost).toBeNull();
    expect(result.get('artifact-1')?.cumulativeTokens).toBeNull();
  });

  it('should fold cited document ingestion cost into cumulative cost only', async () => {
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValue([
      { documentId: 'doc-1', message: { id: 'msg-assistant' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockImplementation(({ where }) => {
      if (where.documentId) { return Promise.resolve([{ documentId: 'doc-1', inputTokensUsed: 200, costPerInputToken: 0.001, outputTokensUsed: 0, costPerOutputToken: 0 }]); }
      return Promise.resolve([usageRow()]);
    });

    const result = await getChatArtifactCosts(['chat-1']);

    // $ Artifact stays the message's own LLM spend of 0.02; the document's
    // 0.2 ingestion cost only shows up in the cumulative figure.
    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.02);
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.22);
  });

  it('should exclude unattributed usage rows from both the message and document cost queries', async () => {
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValue([
      { documentId: 'doc-1', message: { id: 'msg-assistant' } },
    ]);

    await getChatArtifactCosts(['chat-1']);

    expect(db.aiProviderUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userGroupId: { not: null } }) }),
    );
    const documentCall = (db.aiProviderUsage.findMany as jest.Mock).mock.calls
      .find(([args]) => args.where.documentId);
    expect(documentCall[0].where).toEqual(expect.objectContaining({ userGroupId: { not: null } }));
  });

  // A chat is admitted into chatIds by the owner's current group membership, which
  // is not the same as which group a usage row was tagged with when it ran.
  it('should scope usage cost to the exact selected group rather than any attributed group', async () => {
    await getChatArtifactCosts(['chat-1'], 'group-123');

    expect(db.aiProviderUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userGroupId: 'group-123' }) }),
    );
  });

  it('should exclude only unattributed usage when no group is selected', async () => {
    await getChatArtifactCosts(['chat-1']);

    expect(db.aiProviderUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userGroupId: { not: null } }) }),
    );
  });

  it('should keep spend from one chat out of another', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      mockChat,
      { id: 'chat-2', messages: [{ id: 'msg-2', role: 'assistant', createdAt: new Date('2026-01-02') }] },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      mockArtifact,
      { ...mockArtifact, id: 'artifact-2', chatMessageId: 'msg-2', message: { chatId: 'chat-2' } },
    ]);

    const result = await getChatArtifactCosts(['chat-1', 'chat-2']);

    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.02);
    expect(result.get('artifact-2')?.cost).toBeNull();
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.chat.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getChatArtifactCosts(['chat-1']))
      .rejects.toThrow('Unable to fetch chat artifact costs');

    expect(logger.error).toHaveBeenCalledWith('Failed to fetch chat artifact costs', error);
  });
});
