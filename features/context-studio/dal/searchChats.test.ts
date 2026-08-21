import db from '@/server/db';
import logger from '@/server/logger';
import searchChats from './searchChats';

jest.mock('@/server/db', () => ({
  chat: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  chatMessageCitation: {
    findMany: jest.fn(),
  },
  chatArtifact: {
    findMany: jest.fn(),
  },
  document: {
    findMany: jest.fn(),
  },
  aiProviderUsage: {
    findMany: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('searchChats', () => {
  const mockChat = {
    id: 'chat-1',
    summary: 'Test chat',
    createdAt: new Date('2026-06-01'),
    user: { name: 'Test User', email: 'test@example.com' },
    messages: [
      { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
      { id: 'msg-2', role: 'assistant', content: 'Hi there', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
    ],
  };

  const usageRow = (overrides: Record<string, unknown> = {}) => ({
    chatMessageId: 'msg-2',
    stepLabel: 'response',
    inputTokensUsed: 1000,
    costPerInputToken: 0.00001,
    outputTokensUsed: 500,
    costPerOutputToken: 0.00002,
    ...overrides,
  });

  // A retrieval embedding row: same message as usageRow, flagged as embedding so
  // the message-usage query returns it alongside the LLM rows. Costs 0.001.
  const embeddingRow = (overrides: Record<string, unknown> = {}) => ({
    chatMessageId: 'msg-2',
    stepLabel: 'query embedding',
    embedding: true,
    inputTokensUsed: 1000,
    costPerInputToken: 0.000001,
    outputTokensUsed: 0,
    costPerOutputToken: 0,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (db.chat.findMany as jest.Mock).mockResolvedValue([mockChat]);
    (db.chat.count as jest.Mock).mockResolvedValue(1);
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValue([]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([]);
    (db.document.findMany as jest.Mock).mockResolvedValue([]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('should return paginated chat results', async () => {
    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.records[0].id).toBe('chat-1');
    expect(result.records[0].userName).toBe('Test User');
    expect(result.records[0].messages).toHaveLength(2);
  });

  it('should apply keyword search filter on messages', async () => {
    await searchChats({ search: 'hello', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          messages: {
            some: {
              role: 'user',
              content: { contains: 'hello', mode: 'insensitive' },
            },
          },
        }),
      }),
    );
  });

  it('should apply date range filters', async () => {
    await searchChats({ startDate: '2026-01-01', endDate: '2026-06-30', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: new Date('2026-01-01'),
            lt: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('should filter by userId', async () => {
    await searchChats({ userId: 'user-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-123',
        }),
      }),
    );
  });

  it('should filter by userGroupId', async () => {
    await searchChats({ userGroupId: 'group-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            userGroupMemberhip: { some: { userGroupId: 'group-123' } },
          }),
        }),
      }),
    );
  });

  it('should exclude admins when flag is set', async () => {
    await searchChats({ page: 1, pageSize: 20, excludeAdmins: true });

    expect(db.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            role: { not: 'Admin' },
          }),
        }),
      }),
    );
  });

  it('should apply timeRange filter', async () => {
    await searchChats({ timeRange: 'week', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('should not apply timeRange filter for forever', async () => {
    await searchChats({ timeRange: 'forever', page: 1, pageSize: 20, excludeAdmins: false });

    const call = (db.chat.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.createdAt).toBeUndefined();
  });

  it('should map documents from citations with per-document citation counts', async () => {
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValue([
      { message: { chatId: 'chat-1' }, document: { filename: 'doc.pdf' } },
      { message: { chatId: 'chat-1' }, document: { filename: 'doc.pdf' } },
      { message: { chatId: 'chat-1' }, document: { filename: 'other.txt' } },
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].documents).toHaveLength(2);
    expect(result.records[0].documents).toContainEqual({ filename: 'doc.pdf', citationCount: 2 });
    expect(result.records[0].documents).toContainEqual({ filename: 'other.txt', citationCount: 1 });
  });

  it('should map graph documents from graph citations with per-document counts', async () => {
    (db.chatMessageCitation.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { message: { chatId: 'chat-1' }, graphEntity: { document: { filename: 'graph-doc.pdf' } }, graphConcept: null },
        { message: { chatId: 'chat-1' }, graphEntity: { document: { filename: 'graph-doc.pdf' } }, graphConcept: null },
        { message: { chatId: 'chat-1' }, graphEntity: null, graphConcept: { document: { filename: 'concept.txt' } } },
      ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].graphDocuments).toHaveLength(2);
    expect(result.records[0].graphDocuments).toContainEqual({ filename: 'graph-doc.pdf', citationCount: 2 });
    expect(result.records[0].graphDocuments).toContainEqual({ filename: 'concept.txt', citationCount: 1 });
    expect(result.records[0].graphAnchorCitations).toBe(3);
  });

  it('should map attached documents from message documentIds to filenames', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { role: 'user', content: 'Hello', createdAt: new Date('2026-06-01T10:00:00'), documentIds: ['doc-1', 'doc-2'] },
          { role: 'user', content: 'Follow up', createdAt: new Date('2026-06-01T10:05:00'), documentIds: ['doc-1'] },
        ],
      },
    ]);
    (db.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-1', filename: 'attached.pdf' },
      { id: 'doc-2', filename: 'notes.txt' },
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['doc-1', 'doc-2'] } },
      }),
    );
    expect(result.records[0].attachedDocuments).toEqual(['attached.pdf', 'notes.txt']);
  });

  it('should return empty attached documents when messages have none', async () => {
    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].attachedDocuments).toEqual([]);
  });

  it('should map artifacts from chat artifacts', async () => {
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].artifacts).toEqual(['Report.html']);
  });

  it('should request artifacts in creation order', async () => {
    await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // Without an explicit order Postgres may return these rows in any order,
    // so the artifact table's paging shuffles between loads and an artifact can
    // appear to go missing. Creation order also matches the cumulative cost
    // that grows down the list.
    expect(db.chatArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('should attribute the full message cost to a lone artifact', async () => {
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow()]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // 1000 * 0.00001 + 500 * 0.00002 = 0.02
    expect(result.records[0].artifactDetails).toEqual([
      { name: 'Report.html', cost: 0.02, tokens: 1500, cumulativeCost: 0.02, cumulativeTokens: 1500 },
    ]);
  });

  it('should divide the message cost across every artifact that message produced', async () => {
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'One', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
      { label: 'Two', fileExtension: '.md', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow()]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // Only the artifact's own cost is split — both artifacts still needed the
    // whole conversation up to that message.
    expect(result.records[0].artifactDetails).toEqual([
      { name: 'One.html', cost: 0.01, tokens: 750, cumulativeCost: 0.02, cumulativeTokens: 1500 },
      { name: 'Two.md', cost: 0.01, tokens: 750, cumulativeCost: 0.02, cumulativeTokens: 1500 },
    ]);
  });

  it('should sum every usage row for a message before dividing', async () => {
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([
      usageRow({ stepLabel: 'plan' }),
      usageRow({ stepLabel: 'response' }),
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].artifactDetails[0].cost).toBeCloseTo(0.04);
    expect(result.records[0].artifactDetails[0].tokens).toBe(3000);
  });

  it('should report null cost when the generating message has no usage rows', async () => {
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].artifactDetails).toEqual([
      { name: 'Report.html', cost: null, tokens: null, cumulativeCost: null, cumulativeTokens: null },
    ]);
  });

  it('should charge an artifact for every preceding message in the chat', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Draft it', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'Draft', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
          { id: 'msg-3', role: 'user', content: 'Revise it', createdAt: new Date('2026-06-01T10:02:00'), documentIds: [] },
          { id: 'msg-4', role: 'assistant', content: 'Revised', createdAt: new Date('2026-06-01T10:03:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-4', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([
      usageRow({ chatMessageId: 'msg-2' }),
      usageRow({ chatMessageId: 'msg-4' }),
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // The revision alone cost 0.02, but getting there took 0.04.
    expect(result.records[0].artifactDetails[0].cost).toBeCloseTo(0.02);
    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.04);
    expect(result.records[0].artifactDetails[0].cumulativeTokens).toBe(3000);
  });

  it('should exclude spend on messages after the artifact was created', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Draft it', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'Draft', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
          { id: 'msg-3', role: 'user', content: 'Now something else', createdAt: new Date('2026-06-01T10:02:00'), documentIds: [] },
          { id: 'msg-4', role: 'assistant', content: 'Unrelated', createdAt: new Date('2026-06-01T10:03:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([
      usageRow({ chatMessageId: 'msg-2' }),
      usageRow({ chatMessageId: 'msg-4' }),
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // msg-4 came after the artifact — it is not work the artifact required.
    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.02);
  });

  it('should exclude a document cited after the artifact was created', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Draft it', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'Draft', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
          { id: 'msg-3', role: 'user', content: 'Now something else', createdAt: new Date('2026-06-01T10:02:00'), documentIds: [] },
          { id: 'msg-4', role: 'assistant', content: 'Unrelated', createdAt: new Date('2026-06-01T10:03:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValueOnce([
      { documentId: 'doc-1', document: { filename: 'doc.pdf' }, message: { id: 'msg-4', chatId: 'chat-1' } },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock)
      .mockResolvedValueOnce([usageRow({ chatMessageId: 'msg-2' }), usageRow({ chatMessageId: 'msg-4' })])
      .mockResolvedValueOnce([
        { documentId: 'doc-1', inputTokensUsed: 1000, costPerInputToken: 0.00001, outputTokensUsed: 0, costPerOutputToken: 0 },
      ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // doc-1 was cited by msg-4, which came after the artifact — not work the artifact required.
    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.02);
  });

  it('should charge an artifact for the retrieval embeddings that fed it', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Draft it', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'Draft', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow(), embeddingRow()]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // The message's own LLM spend is 0.02; embedding the query to retrieve its
    // context cost another 0.001, and reaching the artifact required both.
    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.021, 5);
    expect(result.records[0].artifactDetails[0].cumulativeTokens).toBe(2500);
  });

  it('should keep an artifact own cost free of retrieval embedding spend', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Draft it', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'Draft', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow(), embeddingRow()]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // $ Artifact is the shipped per-message figure — retrieval spend must not move it.
    expect(result.records[0].artifactDetails[0].cost).toBeCloseTo(0.02, 5);
    expect(result.records[0].artifactDetails[0].tokens).toBe(1500);
  });

  it('should report a chat whose only spend is retrieval as known rather than unknown', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Draft it', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'Draft', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([embeddingRow()]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // Retrieval spend is real spend: an em dash here would read as "no data".
    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.001, 5);
  });

  it('should give each artifact its own cumulative cost as the chat progresses', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'First', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'One', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
          { id: 'msg-3', role: 'user', content: 'Second', createdAt: new Date('2026-06-01T10:02:00'), documentIds: [] },
          { id: 'msg-4', role: 'assistant', content: 'Two', createdAt: new Date('2026-06-01T10:03:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'One', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
      { label: 'Two', fileExtension: '.md', chatMessageId: 'msg-4', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([
      usageRow({ chatMessageId: 'msg-2' }),
      usageRow({ chatMessageId: 'msg-4' }),
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.02);
    expect(result.records[0].artifactDetails[1].cumulativeCost).toBeCloseTo(0.04);
  });

  it('should add each newly-cited document to the running cumulative cost as the chat progresses', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'First', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
          { id: 'msg-2', role: 'assistant', content: 'One', createdAt: new Date('2026-06-01T10:01:00'), documentIds: [] },
          { id: 'msg-3', role: 'user', content: 'Second', createdAt: new Date('2026-06-01T10:02:00'), documentIds: [] },
          { id: 'msg-4', role: 'assistant', content: 'Two', createdAt: new Date('2026-06-01T10:03:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValueOnce([
      { documentId: 'doc-1', document: { filename: 'one.pdf' }, message: { id: 'msg-2', chatId: 'chat-1' } },
      { documentId: 'doc-2', document: { filename: 'two.pdf' }, message: { id: 'msg-4', chatId: 'chat-1' } },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'One', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
      { label: 'Two', fileExtension: '.md', chatMessageId: 'msg-4', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock)
      .mockResolvedValueOnce([usageRow({ chatMessageId: 'msg-2' }), usageRow({ chatMessageId: 'msg-4' })])
      .mockResolvedValueOnce([
        { documentId: 'doc-1', inputTokensUsed: 1000, costPerInputToken: 0.00001, outputTokensUsed: 0, costPerOutputToken: 0 },
        { documentId: 'doc-2', inputTokensUsed: 1000, costPerInputToken: 0.00001, outputTokensUsed: 0, costPerOutputToken: 0 },
      ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // One: its own 0.02 + doc-1's 0.01. Two: msg-2's 0.02 + its own 0.02 + both docs' 0.02.
    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.03);
    expect(result.records[0].artifactDetails[1].cumulativeCost).toBeCloseTo(0.06);
  });

  it('should keep cumulative spend from one chat out of another', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      mockChat,
      {
        ...mockChat,
        id: 'chat-2',
        messages: [
          { id: 'msg-3', role: 'assistant', content: 'Other chat', createdAt: new Date('2026-06-02T10:00:00'), documentIds: [] },
        ],
      },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-3', message: { chatId: 'chat-2' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([
      usageRow({ chatMessageId: 'msg-2' }),
      usageRow({ chatMessageId: 'msg-3' }),
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[1].artifactDetails[0].cumulativeCost).toBeCloseTo(0.02);
  });

  it('should fold a cited document\'s ingestion cost into cumulative cost', async () => {
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValueOnce([
      { documentId: 'doc-1', document: { filename: 'doc.pdf' }, message: { id: 'msg-2', chatId: 'chat-1' } },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock)
      .mockResolvedValueOnce([usageRow()])
      .mockResolvedValueOnce([
        { documentId: 'doc-1', inputTokensUsed: 1000, costPerInputToken: 0.00001, outputTokensUsed: 0, costPerOutputToken: 0 },
      ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // Own cost stays the message's share; cumulative adds the doc's ingestion cost.
    expect(result.records[0].artifactDetails[0].cost).toBeCloseTo(0.02);
    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.03);
    expect(result.records[0].artifactDetails[0].cumulativeTokens).toBe(2500);
  });

  it('should charge a repeatedly-cited document only once', async () => {
    (db.chatMessageCitation.findMany as jest.Mock).mockResolvedValueOnce([
      { documentId: 'doc-1', document: { filename: 'doc.pdf' }, message: { id: 'msg-1', chatId: 'chat-1' } },
      { documentId: 'doc-1', document: { filename: 'doc.pdf' }, message: { id: 'msg-2', chatId: 'chat-1' } },
    ]);
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      { label: 'Report', fileExtension: '.html', chatMessageId: 'msg-2', message: { chatId: 'chat-1' } },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock)
      .mockResolvedValueOnce([usageRow()])
      .mockResolvedValueOnce([
        { documentId: 'doc-1', inputTokensUsed: 1000, costPerInputToken: 0.00001, outputTokensUsed: 0, costPerOutputToken: 0 },
      ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].artifactDetails[0].cumulativeCost).toBeCloseTo(0.03);
  });

  it('should skip the document ingestion cost query when nothing was cited', async () => {
    await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.aiProviderUsage.findMany).toHaveBeenCalledTimes(1);
  });

  it('should expose per-step usage on the generating message', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([
      usageRow({ stepLabel: 'plan' }),
      usageRow({ stepLabel: 'response' }),
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].messages[0].usageSteps).toEqual([]);
    expect(result.records[0].messages[1].usageSteps).toEqual([
      { stepLabel: 'plan', cost: 0.02, tokens: 1500 },
      { stepLabel: 'response', cost: 0.02, tokens: 1500 },
    ]);
  });

  it('should report tokens on steps whose model has no per-token rate configured', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([
      usageRow({ costPerInputToken: 0, costPerOutputToken: 0 }),
    ]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // Zero cost must not be conflated with zero usage — tokens are still known.
    expect(result.records[0].messages[1].usageSteps).toEqual([
      { stepLabel: 'response', cost: 0, tokens: 1500 },
    ]);
  });

  it('should label usage rows with no step as agent steps', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow({ stepLabel: null })]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].messages[1].usageSteps).toEqual([{ stepLabel: 'agent', cost: 0.02, tokens: 1500 }]);
  });

  it('should only query usage for assistant messages', async () => {
    await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.aiProviderUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatMessageId: { in: ['msg-2'] } },
      }),
    );
  });

  it('should skip the usage query when there are no assistant messages', async () => {
    (db.chat.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockChat,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date('2026-06-01T10:00:00'), documentIds: [] },
        ],
      },
    ]);

    await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.aiProviderUsage.findMany).not.toHaveBeenCalled();
  });

  it('should keep embedding rows out of the per-message step breakdown', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow(), embeddingRow()]);

    const result = await searchChats({ page: 1, pageSize: 20, excludeAdmins: false });

    // The steps list and its total are the shipped per-message figure. Retrieval
    // is charged to the cumulative total instead, so no 'query embedding' step
    // may surface here.
    expect(result.records[0].messages[1].usageSteps).toEqual([
      { stepLabel: 'response', cost: 0.02, tokens: 1500 },
    ]);
  });

  it('should handle pagination correctly', async () => {
    await searchChats({ page: 3, pageSize: 5, excludeAdmins: false });

    expect(db.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
      }),
    );
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.chat.findMany as jest.Mock).mockRejectedValue(error);

    await expect(searchChats({ page: 1, pageSize: 20, excludeAdmins: false }))
      .rejects.toThrow('Unable to search chats');

    expect(logger.error).toHaveBeenCalledWith('Failed to search chats', error);
  });
});
