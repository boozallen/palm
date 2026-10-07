import db from '@/server/db';
import deleteWorkflowPrompts from './deleteWorkflowPrompts';

jest.mock('@/server/db', () => ({
  prompt: {
    deleteMany: jest.fn(),
  },
}));

describe('deleteWorkflowPrompts', () => {
  const mockDeleteMany = db.prompt.deleteMany as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete workflow prompts by id', async () => {
    mockDeleteMany.mockResolvedValue({ count: 2 });

    const ids = ['id-1', 'id-2'];
    await deleteWorkflowPrompts(ids);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ids }, workflows: true },
    });
  });

  it('should skip the db call when given an empty array', async () => {
    await deleteWorkflowPrompts([]);

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('should only delete prompts flagged as workflow prompts', async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });

    await deleteWorkflowPrompts(['id-1']);

    const where = mockDeleteMany.mock.calls[0][0].where;
    expect(where.workflows).toBe(true);
  });

  it('should throw on database error', async () => {
    mockDeleteMany.mockRejectedValue(new Error('Database error'));

    await expect(deleteWorkflowPrompts(['id-1'])).rejects.toThrow(
      'Error deleting workflow prompts',
    );
  });
});
