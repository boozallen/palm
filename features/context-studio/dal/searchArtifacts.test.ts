import db from '@/server/db';
import logger from '@/server/logger';
import searchArtifacts from './searchArtifacts';

jest.mock('@/server/db', () => ({
  chatArtifact: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  workflowArtifact: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
}));
jest.mock('@/server/logger');

const mockGetChatArtifactCosts = jest.fn();
jest.mock('./getChatArtifactCosts', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetChatArtifactCosts(...args),
}));

const mockGetWorkflowArtifactCosts = jest.fn();
jest.mock('./getWorkflowArtifactCosts', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetWorkflowArtifactCosts(...args),
}));

const mockGetArtifactSizes = jest.fn();
jest.mock('./getArtifactSizes', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetArtifactSizes(...args),
}));

describe('searchArtifacts', () => {
  const chatRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'chat-artifact-1',
    label: 'Report',
    fileExtension: '.html',
    createdAt: new Date('2026-06-02'),
    message: { chatId: 'chat-1', chat: { user: { name: 'Chat User' } } },
    ...overrides,
  });

  const workflowRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'workflow-artifact-1',
    label: 'Summary',
    fileExtension: '.pdf',
    createdAt: new Date('2026-06-01'),
    workflowExecutionId: 'exec-1',
    workflowExecution: { user: { name: 'Workflow User' }, workflow: { name: 'Monthly' } },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([chatRow()]);
    (db.chatArtifact.count as jest.Mock).mockResolvedValue(1);
    (db.chatArtifact.groupBy as jest.Mock).mockResolvedValue([{ fileExtension: '.html', _count: 1 }]);
    (db.workflowArtifact.findMany as jest.Mock).mockResolvedValue([workflowRow()]);
    (db.workflowArtifact.count as jest.Mock).mockResolvedValue(1);
    (db.workflowArtifact.groupBy as jest.Mock).mockResolvedValue([{ fileExtension: '.pdf', _count: 1 }]);
    mockGetChatArtifactCosts.mockResolvedValue(new Map([
      ['chat-artifact-1', { artifactId: 'chat-artifact-1', chatId: 'chat-1', name: 'Report.html', cost: 0.02, tokens: 1500, cumulativeCost: 0.02, cumulativeTokens: 1500 }],
    ]));
    mockGetWorkflowArtifactCosts.mockResolvedValue(new Map([
      ['workflow-artifact-1', { artifactId: 'workflow-artifact-1', label: 'Summary', fileExtension: '.pdf', workflowExecutionId: 'exec-1', cost: 0.05, tokens: 4000, cumulativeCost: 0.05, cumulativeTokens: 4000 }],
    ]));
    mockGetArtifactSizes.mockResolvedValue(new Map([
      ['chat-artifact-1', 1024],
      ['workflow-artifact-1', 2048],
    ]));
  });

  it('should merge chat and workflow artifacts sorted by createdAt desc', async () => {
    const result = await searchArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.totalCount).toBe(2);
    expect(result.records.map((r) => r.id)).toEqual(['chat-artifact-1', 'workflow-artifact-1']);
    expect(result.records[0]).toMatchObject({ source: 'chat', name: 'Report.html', userName: 'Chat User', cost: 0.02, sizeBytes: 1024 });
    expect(result.records[1]).toMatchObject({ source: 'workflow', name: 'Summary.pdf', userName: 'Workflow User', workflowName: 'Monthly', cost: 0.05, sizeBytes: 2048 });
  });

  it('should hydrate sizes only for artifacts on the requested page, split by source', async () => {
    await searchArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(mockGetArtifactSizes).toHaveBeenCalledWith(['chat-artifact-1'], ['workflow-artifact-1']);
  });

  it('should default sizeBytes to null when the artifact is missing from the size map', async () => {
    mockGetArtifactSizes.mockResolvedValue(new Map());

    const result = await searchArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records.every((r) => r.sizeBytes === null)).toBe(true);
  });

  it('should merge file-extension counts across both sources', async () => {
    const result = await searchArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.typeCounts).toEqual({ '.html': 1, '.pdf': 1 });
  });

  it('should only query chat artifacts when source is chat', async () => {
    await searchArtifacts({ source: 'chat', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chatArtifact.findMany).toHaveBeenCalled();
    expect(db.workflowArtifact.findMany).not.toHaveBeenCalled();
  });

  it('should only query workflow artifacts when source is workflow', async () => {
    await searchArtifacts({ source: 'workflow', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.workflowArtifact.findMany).toHaveBeenCalled();
    expect(db.chatArtifact.findMany).not.toHaveBeenCalled();
  });

  it('should over-fetch page * pageSize candidates from each source', async () => {
    await searchArtifacts({ page: 3, pageSize: 5, excludeAdmins: false });

    expect(db.chatArtifact.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 15 }));
    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 15 }));
  });

  it('should only hydrate costs for artifacts on the requested page', async () => {
    (db.chatArtifact.findMany as jest.Mock).mockResolvedValue([
      chatRow({ id: 'chat-artifact-1', createdAt: new Date('2026-06-05') }),
      chatRow({ id: 'chat-artifact-2', createdAt: new Date('2026-06-04'), message: { chatId: 'chat-2', chat: { user: { name: 'Other' } } } }),
    ]);
    (db.chatArtifact.count as jest.Mock).mockResolvedValue(2);

    await searchArtifacts({ page: 1, pageSize: 1, excludeAdmins: false });

    expect(mockGetChatArtifactCosts).toHaveBeenCalledWith(['chat-1'], undefined);
  });

  it('should pass the selected group through to both cost lookups', async () => {
    await searchArtifacts({ userGroupId: 'group-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(mockGetChatArtifactCosts).toHaveBeenCalledWith(['chat-1'], 'group-123');
    expect(mockGetWorkflowArtifactCosts).toHaveBeenCalledWith(['exec-1'], 'group-123');
  });

  it('should filter by fileType via the artifact fileExtension column', async () => {
    await searchArtifacts({ fileType: '.pdf', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chatArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fileExtension: '.pdf' }) }),
    );
    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fileExtension: '.pdf' }) }),
    );
    // The breakdown ignores fileType so the dropdown lists every type available.
    expect(db.chatArtifact.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ fileExtension: expect.anything() }) }),
    );
  });

  it('should scope chat artifacts by the chat createdAt, not the artifact createdAt', async () => {
    await searchArtifacts({ timeRange: 'week', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.chatArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          message: { chat: { createdAt: { gte: expect.any(Date) } } },
        }),
      }),
    );
    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: expect.any(Date) } }),
      }),
    );
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.chatArtifact.findMany as jest.Mock).mockRejectedValue(error);

    await expect(searchArtifacts({ page: 1, pageSize: 20, excludeAdmins: false }))
      .rejects.toThrow('Unable to search artifacts');

    expect(logger.error).toHaveBeenCalledWith('Failed to search artifacts', error);
  });
});
