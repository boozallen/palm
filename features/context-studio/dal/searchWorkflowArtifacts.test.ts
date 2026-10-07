import db from '@/server/db';
import logger from '@/server/logger';
import getWorkflowArtifactCosts from './getWorkflowArtifactCosts';
import searchWorkflowArtifacts from './searchWorkflowArtifacts';

jest.mock('@/server/db', () => ({
  workflowArtifact: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));
jest.mock('@/server/logger');
jest.mock('./getWorkflowArtifactCosts');

describe('searchWorkflowArtifacts', () => {
  const mockArtifact = {
    id: 'artifact-1',
    label: 'Report',
    fileExtension: '.html',
    createdAt: new Date('2026-06-01'),
    workflowExecutionId: 'exec-1',
    workflowExecution: {
      user: { name: 'Test User' },
      workflow: { name: 'Monthly Report' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.workflowArtifact.findMany as jest.Mock).mockResolvedValue([mockArtifact]);
    (db.workflowArtifact.count as jest.Mock).mockResolvedValue(1);
    (getWorkflowArtifactCosts as jest.Mock).mockResolvedValue(new Map());
  });

  it('should return paginated artifact results', async () => {
    const result = await searchWorkflowArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.totalCount).toBe(1);
    expect(result.records).toEqual([
      {
        id: 'artifact-1',
        name: 'Report.html',
        workflowName: 'Monthly Report',
        userName: 'Test User',
        createdAt: new Date('2026-06-01'),
        cost: null,
        tokens: null,
        cumulativeCost: null,
        cumulativeTokens: null,
      },
    ]);
  });

  it('should join resolved costs onto the records', async () => {
    (getWorkflowArtifactCosts as jest.Mock).mockResolvedValue(
      new Map([[
        'artifact-1',
        { cost: 0.02, tokens: 1500, cumulativeCost: 0.05, cumulativeTokens: 4000 },
      ]]),
    );

    const result = await searchWorkflowArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].cost).toBe(0.02);
    expect(result.records[0].tokens).toBe(1500);
    expect(result.records[0].cumulativeCost).toBe(0.05);
    expect(result.records[0].cumulativeTokens).toBe(4000);
  });

  it('should request costs for the deduplicated execution ids on the page', async () => {
    (db.workflowArtifact.findMany as jest.Mock).mockResolvedValue([
      mockArtifact,
      { ...mockArtifact, id: 'artifact-2' },
      { ...mockArtifact, id: 'artifact-3', workflowExecutionId: 'exec-2' },
    ]);

    await searchWorkflowArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(getWorkflowArtifactCosts).toHaveBeenCalledWith(['exec-1', 'exec-2'], undefined);
  });

  it('should pass the selected group through to the cost lookup', async () => {
    await searchWorkflowArtifacts({ userGroupId: 'group-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(getWorkflowArtifactCosts).toHaveBeenCalledWith(['exec-1'], 'group-123');
  });

  it('should apply the label search filter', async () => {
    await searchWorkflowArtifacts({ search: 'report', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          label: { contains: 'report', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should apply the timeRange filter', async () => {
    await searchWorkflowArtifacts({ timeRange: 'week', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  it('should not apply the timeRange filter for forever', async () => {
    await searchWorkflowArtifacts({ timeRange: 'forever', page: 1, pageSize: 20, excludeAdmins: false });

    const call = (db.workflowArtifact.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.createdAt).toBeUndefined();
  });

  it('should filter by the triggering user', async () => {
    await searchWorkflowArtifacts({ userId: 'user-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workflowExecution: expect.objectContaining({ triggeredBy: 'user-123' }),
        }),
      }),
    );
  });

  it('should filter by user group', async () => {
    await searchWorkflowArtifacts({ userGroupId: 'group-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workflowExecution: expect.objectContaining({
            user: expect.objectContaining({
              userGroupMemberhip: { some: { userGroupId: 'group-123' } },
            }),
          }),
        }),
      }),
    );
  });

  it('should exclude admins when the flag is set', async () => {
    await searchWorkflowArtifacts({ page: 1, pageSize: 20, excludeAdmins: true });

    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workflowExecution: expect.objectContaining({
            user: expect.objectContaining({ role: { not: 'Admin' } }),
          }),
        }),
      }),
    );
  });

  it('should handle pagination correctly', async () => {
    await searchWorkflowArtifacts({ page: 3, pageSize: 5, excludeAdmins: false });

    expect(db.workflowArtifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });

  it('should fall back to null names when the execution has no user or workflow', async () => {
    (db.workflowArtifact.findMany as jest.Mock).mockResolvedValue([
      { ...mockArtifact, workflowExecution: { user: null, workflow: null } },
    ]);

    const result = await searchWorkflowArtifacts({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].workflowName).toBeNull();
    expect(result.records[0].userName).toBeNull();
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.workflowArtifact.findMany as jest.Mock).mockRejectedValue(error);

    await expect(searchWorkflowArtifacts({ page: 1, pageSize: 20, excludeAdmins: false }))
      .rejects.toThrow('Unable to search workflow artifacts');

    expect(logger.error).toHaveBeenCalledWith('Failed to search workflow artifacts', error);
  });
});
