import db from '@/server/db';
import getWorkflows from './getWorkflows';

jest.mock('@/server/db', () => ({
  workflow: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';

const mockWorkflow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Workflow',
  createdBy: mockUserId,
  deletedAt: null,
  creator: { id: mockUserId, name: 'Alice', email: 'alice@example.com' },
  userGroups: [],
  _count: { executions: 0 },
};

describe('getWorkflows', () => {
  const mockFindMany = db.workflow.findMany as jest.Mock;
  const mockCount = db.workflow.count as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return workflows and total count', async () => {
    mockFindMany.mockResolvedValue([mockWorkflow]);
    mockCount.mockResolvedValue(1);

    const result = await getWorkflows(mockUserId, 10, 0);

    expect(result).toEqual({ workflows: [mockWorkflow], total: 1 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should only query workflows created by the user', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getWorkflows(mockUserId, 10, 0);

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere).toEqual({
      deletedAt: null,
      createdBy: mockUserId,
    });
  });

  it('should pass the same where clause to both findMany and count', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getWorkflows(mockUserId, 10, 0);

    const findManyWhere = mockFindMany.mock.calls[0][0].where;
    const countWhere = mockCount.mock.calls[0][0].where;
    expect(findManyWhere).toEqual(countWhere);
  });

  it('should add userGroups filter when userGroupId is provided', async () => {
    const groupId = '550e8400-e29b-41d4-a716-446655440099';
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getWorkflows(mockUserId, 10, 0, groupId);

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.userGroups).toEqual({ some: { id: groupId } });
  });

  it('should apply pagination with limit and offset', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getWorkflows(mockUserId, 5, 10);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 10 }),
    );
  });

  it('should throw on database error', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'));

    await expect(getWorkflows(mockUserId, 10, 0)).rejects.toThrow(
      'Error listing workflows',
    );
  });
});
